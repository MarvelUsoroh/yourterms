// content/detector.js
// check if current page is terms of service or privacy policy

const TC_URL_PATTERNS = [
  /\/terms/i, /\/tos\b/i, /\/conditions/i, /\/legal/i,
  /\/privacy/i, /\/policy/i, /\/eula/i, /\/user.?agreement/i,
];

const TC_TITLE_PATTERNS = [
  /terms\s+(of\s+)?(service|use|conditions)/i,
  /privacy\s+policy/i,
  /end[\s-]user\s+license/i,
  /user\s+agreement/i,
  /cookie\s+policy/i,
  /legal\s+notice/i,
];

const TC_HEADING_PATTERNS = [
  /terms\s+(of\s+)?service/i,
  /privacy\s+policy/i,
  /acceptance\s+of\s+terms/i,
  /your\s+agreement/i,
];

function detectTnCPage() {
  const url = window.location.href.toLowerCase();
  const params = window.location.search.toLowerCase();
  const title = document.title || '';
  const h1 = document.querySelector('h1')?.textContent || '';
  const h2 = document.querySelector('h2')?.textContent || '';

  // check url parameters
  const QUERY_TC_PATTERNS = [/\bterms\b/i, /\bprivacy\b/i, /\bpolicy\b/i, /\blegal\b/i, /\bconditions\b/i, /\btos\b/i, /\beula\b/i];

  return (
    TC_URL_PATTERNS.some(rx => rx.test(url)) ||
    QUERY_TC_PATTERNS.some(rx => rx.test(params)) ||
    TC_TITLE_PATTERNS.some(rx => rx.test(title)) ||
    TC_HEADING_PATTERNS.some(rx => rx.test(h1)) ||
    TC_HEADING_PATTERNS.some(rx => rx.test(h2))
  );
}

// try to get only the legal text and remove navbars

// Tags whose content should be excluded (navigation, ads, footers, etc.)
const SKIP_SELECTORS = [
  'nav', 'header', 'footer', 'aside', 'script', 'style', 'noscript',
  '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
  '.cookie-banner', '.modal', '#cookie', '.nav', '.menu', '.header', '.footer',
  '[class*="navigation"]', '[class*="sidebar"]', '[id*="sidebar"]',
].join(', ');

function extractText() {
  // hide elements and get text
  const hiddenElements = [];

  // 1. hide bad elements
  document.querySelectorAll(SKIP_SELECTORS).forEach(el => {
    // Store original inline display value (if any)
    hiddenElements.push({ el, origDisplay: el.style.display });
    el.style.display = 'none';
  });

  // 2. find main text
  let main = (
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('article') ||
    document.querySelector('.content') ||
    document.querySelector('#content') ||
    document.querySelector('.terms') ||
    document.querySelector('#terms') ||
    document.querySelector('[class*="legal"]') ||
    document.querySelector('[class*="policy"]') ||
    document.querySelector('[id*="legal"]') ||
    document.querySelector('[id*="policy"]')
  );

  if (!main || (main.innerText || '').trim().length < 500) {
    main = document.body;
  }

  // 3. get text
  let text = (main.innerText || main.textContent || '').trim();

  // 4. put elements back
  hiddenElements.forEach(({ el, origDisplay }) => {
    el.style.display = origDisplay;
  });

  // get text from shadow dom if word count is too low
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 200) {
    const shadowText = extractShadowText(document.body);
    if (shadowText.length > text.length) {
      text = shadowText;
    }
  }

  return text
    .replace(/\t+/g, ' ')
    .replace(/ {3,}/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

/**
 * walk through shadow doms
 */
function extractShadowText(root) {
  const texts = [];

  function walk(node) {
    if (!node) return;
    if (node.shadowRoot) {
      const t = (node.shadowRoot.innerText || node.shadowRoot.textContent || '').trim();
      if (t.length > 100) texts.push(t);
      // Recurse into shadow root children for nested shadows
      Array.from(node.shadowRoot.children || []).forEach(walk);
    }
    Array.from(node.children || []).forEach(walk);
  }

  walk(root);
  if (texts.length === 0) return '';
  // Return the longest block (most complete shadow root)
  return texts.sort((a, b) => b.length - a.length)[0];
}

// listen for popup messages

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'EXTRACT_TEXT') return;

  try {
    const isTC = detectTnCPage();
    const text = isTC ? extractText() : '';
    const title = document.title || '';
    const url = window.location.href;
    const domain = window.location.hostname.replace(/^www\./, '');
    const wordCount = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;

    sendResponse({ isTC, text, url, domain, title, wordCount });
  } catch (err) {
    console.error('[yourTerms] Extraction error:', err);
    sendResponse({ isTC: false, text: '', url: window.location.href, domain: '', title: '', wordCount: 0, error: err.message });
  }

  return true; // Keep channel open for async response
});

// tell popup if it's a tc page
if (detectTnCPage()) {
  chrome.runtime.sendMessage({ type: 'TC_PAGE_DETECTED', url: window.location.href }).catch(() => {
    // Popup may not be open yet
  });
}
