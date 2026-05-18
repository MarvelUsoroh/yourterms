// popup/popup.js
// manages the flow of the app
import { preFilter, CATEGORIES } from '../lib/keywords.js';
import { calculateScore, LEVEL_LABELS } from '../lib/scorer.js';
import { getCached, saveCache, hashUrl, extractDomain, seedPopularCache, clearLocalCache } from '../lib/cache.js';

const state = {
  currentView: 'idle',
  domain: '',
  tcText: '',
  tcUrl: '',
  urlHash: '',
  flags: [],
  riskScore: 0,
  riskLevel: 'safe',
  chatHistory: [],  // { role: 'user'|'model', content: string }
  fromCache: false,
  cacheSource: '',
  jurisdiction: '',
};

const $ = id => document.getElementById(id);

const dom = {
  headerDomain: $('header-domain'),
  headerBadge: $('header-risk-badge'),
  backBtn: $('btn-back'),
  settingsBtn: $('btn-settings'),
  pasteInput: $('paste-input'),
  btnAnalysePaste: $('btn-analyse-paste'),
  btnRetry: $('btn-retry'),
  loadingStatus: $('loading-status'),
  riskScore: $('risk-score'),
  riskLabel: $('risk-label'),
  riskBarFill: $('risk-bar-fill'),
  riskBarTrack: $('risk-bar-track'),
  riskMeta: $('risk-meta'),
  cacheBadge: $('cache-badge'),
  jurisdictionBadge: $('jurisdiction-badge'),
  flagsContainer: $('flags-container'),
  cleanContainer: $('clean-container'),
  cleanText: $('clean-text'),
  messageList: $('message-list'),
  chatInput: $('chat-input'),
  sendBtn: $('btn-send'),
  
  geminiKey: $('input-gemini-key'),
  saveKeysBtn: $('btn-save-keys'),
  settingsSaved: $('settings-saved'),
};

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.querySelector(`[data-view="${viewName}"]`);
  if (target) target.classList.add('active');
  state.currentView = viewName;

  // Header back button — only in chat view
  dom.backBtn.classList.toggle('visible', viewName === 'chat');

  // Chat input enabled once we have results
  const canChat = ['results', 'chat'].includes(viewName) && state.tcText;
  dom.chatInput.disabled = !canChat;
  dom.sendBtn.disabled = !canChat;
  if (viewName === 'chat') dom.chatInput.focus();
}

// Helper functions to manage the 3-stage visual loading indicator
const stages = ['fetch', 'identify', 'assess'];

function setStage(stageId, status = 'active', label = null) {
  const icon = $(`icon-${stageId}`);
  if (!icon) return;
  icon.className = 'stage-icon';
  if (status === 'done') icon.classList.add('stage-icon--done');
  if (status === 'active') icon.classList.add('stage-icon--active');
  if (status === 'pending') icon.classList.add('stage-icon--pending');

  if (label) {
    const lbl = $(`label-${stageId}`);
    if (lbl) lbl.textContent = label;
  }
}

function completeStage(stageId, label = null) {
  setStage(stageId, 'done', label);
  const idx = stages.indexOf(stageId);
  if (idx + 1 < stages.length) setStage(stages[idx + 1], 'active');
}

function setStatus(msg) {
  if (dom.loadingStatus) dom.loadingStatus.textContent = msg;
}

function renderRiskBadge(level, label, container) {
  container.innerHTML = `
    <div class="risk-badge risk-badge--${level}" role="status">
      <span class="risk-dot risk-dot--${level}" aria-hidden="true"></span>
      ${label}
    </div>`;
  container.style.display = 'block';
}

function renderRiskHero(score, level, flags, fromCache, cacheSource) {
  const label = LEVEL_LABELS[level];

  dom.riskScore.textContent = score;
  dom.riskScore.className = `risk-hero__score risk-hero__score--${level}`;
  dom.riskLabel.textContent = label;
  dom.riskLabel.className = `risk-hero__label risk-hero__label--${level}`;

  // Animate bar
  dom.riskBarFill.className = `risk-hero__bar-fill risk-hero__bar-fill--${level}`;
  dom.riskBarFill.style.width = '0%';
  dom.riskBarTrack.setAttribute('aria-valuenow', score);
  requestAnimationFrame(() => {
    dom.riskBarFill.style.width = `${score}%`;
  });

  const highCount = flags.filter(f => f.risk_level === 'high').length;
  const medCount = flags.filter(f => f.risk_level === 'medium').length;
  const issuesTotal = flags.length;
  dom.riskMeta.textContent = issuesTotal > 0
    ? `${issuesTotal} issue${issuesTotal > 1 ? 's' : ''} found · ${highCount} high · ${medCount} medium`
    : 'No issues detected';

  if (fromCache) {
    dom.cacheBadge.innerHTML = `<span class="cache-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:2px"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>${cacheSource === 'local' ? 'cached' : 'shared cache'}</span>`;
  } else {
    dom.cacheBadge.innerHTML = '';
  }

  renderRiskBadge(level, label, dom.headerBadge);
}

// Maps backend category strings to human-readable UI pills
const CATEGORY_PILL_MAP = {
  UNILATERAL_CHANGE: { label: 'Unilateral Change', cls: 'pill--change' },
  UNILATERAL_TERMINATION: { label: 'Unilateral Termination', cls: 'pill--terminate' },
  LIMITATION_OF_LIABILITY: { label: 'Limitation of Liability', cls: 'pill--liability' },
  CONTENT_OWNERSHIP: { label: 'Content Ownership', cls: 'pill--ownership' },
  JURISDICTION: { label: 'Jurisdiction', cls: 'pill--jurisdiction' },
};

const RISK_LEVEL_LABELS = { high: 'High risk', medium: 'Medium risk', low: 'Low risk' };

function renderFlags(flags) {
  dom.flagsContainer.innerHTML = '';

  if (flags.length === 0) {
    dom.cleanContainer.style.display = 'block';
    dom.cleanText.textContent = 'No contractual issues were detected across the 5 GDPR-related categories (change, termination, liability, content, jurisdiction). If this is a Privacy Policy, data collection and sharing practices may require separate review.';
    return;
  }

  dom.cleanContainer.style.display = 'none';

  // Sort: high → medium → low
  const sorted = [...flags].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.risk_level] ?? 1) - (order[b.risk_level] ?? 1);
  });

  const label = document.createElement('p');
  label.className = 'section-label';
  label.textContent = `Issues found (${sorted.length})`;
  label.setAttribute('aria-label', `${sorted.length} issues found`);
  dom.flagsContainer.appendChild(label);

  sorted.forEach((flag, idx) => {
    const catMeta = CATEGORY_PILL_MAP[flag.category] || { label: flag.category, cls: 'pill--change' };
    const card = document.createElement('article');
    card.className = 'clause-card';
    card.dataset.category = flag.category;   // drives CSS left-border colour
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `${catMeta.label} — ${RISK_LEVEL_LABELS[flag.risk_level]}`);

    card.innerHTML = `
      <div class="clause-card__pills">
        <span class="pill ${catMeta.cls}">${catMeta.label}</span>
        ${flag.gdpr_article ? `<span class="pill pill--article">${flag.gdpr_article}</span>` : ''}
      </div>
      <blockquote class="clause-card__excerpt" tabindex="0"
                  title="Click to find this clause on the page"
                  data-excerpt="${escapeAttr(flag.excerpt)}"
                  aria-label="Clause excerpt — click to locate on page">"${escapeHtml(flag.excerpt)}"</blockquote>
      <p class="clause-card__explanation">${escapeHtml(flag.explanation)}</p>
      ${flag.cross_region_note ? `<div class="clause-card__cross-region" role="note" aria-label="Cross-region context"><span class="cross-region-icon">🌍</span>${escapeHtml(flag.cross_region_note)}</div>` : ''}
      <div class="clause-card__footer">
        <span class="clause-card__risk-level clause-card__risk-level--${flag.risk_level}">
          ${flag.risk_level === 'high' ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>` : `<span class="risk-dot risk-dot--${flag.risk_level}" aria-hidden="true"></span>`}
          ${RISK_LEVEL_LABELS[flag.risk_level]}
        </span>
        <button class="clause-card__ask-btn"
                data-ask="${escapeAttr(flag.explanation)}"
                aria-label="Ask yourTerms about this clause">
          Ask yourTerms <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>`;

    // Click excerpt → find and scroll to it on the page
    const excerpt = card.querySelector('.clause-card__excerpt');
    excerpt.addEventListener('click', async () => {
      const excerptText = flag.excerpt;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !excerptText) return;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (searchText) => {
            const clean = searchText.replace(/^["'"]/u, '').replace(/["'"]$/u, '').trim().toLowerCase();
            // Try progressively shorter substrings
            const attempts = [
              clean,
              clean.slice(0, 120),
              clean.slice(0, 80),
              clean.slice(0, 60),
              clean.slice(0, 40),
            ].filter(s => s.length >= 8);

            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
              acceptNode(node) {
                const p = node.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                if (['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'NOSCRIPT'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
              }
            });
            const nodes = [];
            let n;
            while ((n = walker.nextNode())) nodes.push(n);

            for (const attempt of attempts) {
              for (const textNode of nodes) {
                if ((textNode.textContent || '').toLowerCase().includes(attempt)) {
                  const el = textNode.parentElement;
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Briefly flash the element
                    const orig = el.style.outline;
                    el.style.outline = '2px solid rgba(109, 40, 217, 0.6)';
                    el.style.outlineOffset = '2px';
                    el.style.borderRadius = '4px';
                    setTimeout(() => { el.style.outline = orig; el.style.outlineOffset = ''; el.style.borderRadius = ''; }, 2500);
                    return true;
                  }
                }
              }
            }
            return false;
          },
          args: [excerptText]
        });
      } catch { /* page may not support scripting */ }
    });
    excerpt.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') excerpt.click();
    });

    // "Ask yourTerms" button
    const askBtn = card.querySelector('[data-ask]');
    askBtn.addEventListener('click', () => {
      const q = `Can you explain more about this issue: "${flag.explanation}"?`;
      showView('chat');
      sendChatMessage(q);
    });

    dom.flagsContainer.appendChild(card);
  });
}

// Safely render a small subset of markdown in chat bubbles:
// **bold**, *italic*, and newlines → <br>. HTML is escaped first to prevent XSS.
function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // escape HTML first
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')                    // **bold**
    .replace(/\*(.+?)\*/g, '<em>$1</em>')                                 // *italic*
    .replace(/\n/g, '<br>');                                              // newlines
}

// Append new message bubble to the chat thread
function appendMessage(role, text) {
  const div = document.createElement('div');
  div.className = `message message--${role === 'user' ? 'user' : 'ai'}`;
  if (role === 'user') {
    div.textContent = text; // user messages are plain text
  } else {
    div.innerHTML = renderMarkdown(text); // AI messages may contain markdown
  }
  dom.messageList.appendChild(div);
  dom.messageList.scrollTop = dom.messageList.scrollHeight;
  return div;
}

function showTyping() {
  const t = document.createElement('div');
  t.className = 'typing-indicator';
  t.id = 'typing-indicator';
  t.setAttribute('aria-label', 'yourTerms is thinking');
  t.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  dom.messageList.appendChild(t);
  dom.messageList.scrollTop = dom.messageList.scrollHeight;
}

function hideTyping() {
  $('typing-indicator')?.remove();
}

async function sendChatMessage(text) {
  if (!text.trim() || !state.tcText) return;

  showView('chat');
  appendMessage('user', text);
  dom.chatInput.value = '';
  dom.chatInput.style.height = 'auto';
  dom.sendBtn.disabled = true;
  showTyping();

  // Push to history
  state.chatHistory.push({ role: 'user', content: text });

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'CHAT',
      question: text,
      tcText: state.tcText,
      history: state.chatHistory.slice(-8), // last 4 exchanges = 8 messages
    });

    hideTyping();

    if (res?.error) throw new Error(res.error);

    const answer = res?.answer || 'Sorry, I couldn\'t answer that.';
    appendMessage('ai', answer);
    state.chatHistory.push({ role: 'model', content: answer });

  } catch (err) {
    hideTyping();
    appendMessage('ai', `Error: ${err.message}`);
  } finally {
    dom.sendBtn.disabled = false;
    dom.chatInput.focus();
  }
}

// main function to run analysis
async function runAnalysis(text, url, domain, force = false) {
  state.tcText = text;
  state.tcUrl = url;
  state.domain = domain;

  showView('loading');
  dom.headerDomain.textContent = domain;

  // Reset stages
  stages.forEach(s => setStage(s, 'pending'));

    setStatus('Reading the page…');
  setStage('fetch', 'active');
  await tick(80);
  completeStage('fetch', 'Text extracted');

    setStatus('Scanning for suspicious language…');
  const { flaggedParagraphs, stats } = preFilter(text);

  const urlHash = await hashUrl(url);
  state.urlHash = urlHash;
  await tick(60);
  const cached = force ? null : await getCached(urlHash, domain, url);

  if (cached) {
    completeStage('identify', 'Clauses identified');
    setStage('assess', 'active');
    await tick(100);
    completeStage('assess', `Risk calculated (cached)`);

    const flags = cached.data.flags || [];
    const riskScore = cached.data.risk_score ?? cached.data.riskScore ?? 0;
    const riskLevel = cached.data.risk_level ?? cached.data.riskLevel ?? 'safe';

    state.flags = flags;
    state.riskScore = riskScore;
    state.riskLevel = riskLevel;
    state.fromCache = true;
    state.cacheSource = cached.source;

    renderResults();
    return;
  }

  completeStage('identify', `${flaggedParagraphs.length} suspicious clauses found`);

    setStatus(`Analysing flagged clauses…`);
  setStage('assess', 'active', `Asking AI to classify…`);

  const result = await chrome.runtime.sendMessage({
    type: 'ANALYSE',
    flaggedParagraphs,
    domain,
    urlHash,
    tcUrl: url,
    clausesChecked: stats.total,
    force,
  });

  completeStage('assess', 'Analysis complete');

  if (result?.error) throw new Error(result.error);

  await tick(200);

  state.flags = result.flags;
  state.riskScore = result.riskScore;
  state.riskLevel = result.riskLevel;
  state.fromCache = result.fromCache || false;
  state.cacheSource = result.cacheSource || '';
  state.jurisdiction = result.jurisdiction || '';

  // Save to local cache
  await saveCache({
    urlHash,
    domain,
    riskScore: result.riskScore,
    riskLevel: result.riskLevel,
    flags: result.flags,
    clausesChecked: stats.total,
    tcUrl: url,
    jurisdiction: result.jurisdiction || '',
  });

  renderResults();
}

function renderResults() {
  renderRiskHero(state.riskScore, state.riskLevel, state.flags, state.fromCache, state.cacheSource);
  renderJurisdictionBadge(state.jurisdiction);
  renderFlags(state.flags);
  showView('results');
  // Trigger in-page clause highlighting
  triggerPageHighlight();
}

function renderJurisdictionBadge(jurisdiction) {
  if (!dom.jurisdictionBadge) return;
  if (!jurisdiction || jurisdiction === 'Unknown') {
    dom.jurisdictionBadge.innerHTML = '';
    return;
  }
  const isEEA = jurisdiction.includes('EEA') || jurisdiction.includes('UK');
  const icon = isEEA ? '🇪🇺' : '🌍';
  const label = isEEA ? `${icon} ${jurisdiction} · GDPR protections apply` : `${icon} ${jurisdiction} · Standard protections`;
  dom.jurisdictionBadge.innerHTML = `<span class="jurisdiction-badge jurisdiction-badge--${isEEA ? 'eea' : 'row'}">${label}</span>`;
}

async function triggerPageHighlight() {
  if (!state.flags || state.flags.length === 0) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Try content script first
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'HIGHLIGHT_CLAUSES',
        flags: state.flags,
        riskLevel: state.riskLevel,
      });
    } catch (err) {

      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (flags, riskLevel) => {
          // Inline highlighter with keyword-based fallback
          if (window.__yourTermsHighlighterActive) {
            document.querySelectorAll('.yourTerms-highlight').forEach(el => {
              const text = document.createTextNode(el.textContent);
              el.parentNode.replaceChild(text, el);
            });
          }

          window.__yourTermsHighlighterActive = true;

          // Inject styles
          if (!document.getElementById('yourTerms-highlight-styles')) {
            const style = document.createElement('style');
            style.id = 'yourTerms-highlight-styles';
            style.textContent = `
              .yourTerms-highlight {
                background: rgba(109, 40, 217, 0.12) !important;
                border-bottom: 2px solid rgba(109, 40, 217, 0.7) !important;
                border-radius: 2px !important;
                padding: 2px 0 !important;
              }
              .yourTerms-highlight[data-risk="high"] {
                background: rgba(192, 40, 14, 0.10) !important;
                border-bottom-color: rgba(192, 40, 14, 0.7) !important;
              }
              .yourTerms-highlight[data-risk="medium"] {
                background: rgba(180, 83, 9, 0.10) !important;
                border-bottom-color: rgba(180, 83, 9, 0.7) !important;
              }
              .yourTerms-badge {
                position: fixed !important;
                bottom: 24px !important;
                right: 24px !important;
                z-index: 2147483646 !important;
                background: #1A1917 !important;
                color: #F0EFEB !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
                font-size: 12px !important;
                padding: 8px 14px !important;
                border-radius: 999px !important;
                box-shadow: 0 2px 12px rgba(0,0,0,0.3) !important;
                cursor: pointer !important;
              }
            `;
            document.head.appendChild(style);
          }

          // Category-based keywords for fallback highlighting
          const CATEGORY_KEYWORDS = {
            'UNILATERAL_CHANGE': ['modify', 'change', 'update', 'amend', 'revise', 'alter'],
            'UNILATERAL_TERMINATION': ['terminate', 'suspend', 'disable', 'ban', 'remove', 'delete account'],
            'LIMITATION_OF_LIABILITY': ['not liable', 'not responsible', 'disclaim', 'no warranty', 'as is'],
            'CONTENT_OWNERSHIP': ['grant', 'license', 'rights', 'ownership', 'intellectual property', 'perpetual'],
            'JURISDICTION': ['arbitration', 'governing law', 'jurisdiction', 'dispute resolution', 'waive']
          };

          // Highlight function with keyword fallback
          function findAndHighlight(flag) {
            const excerpt = flag.excerpt;
            const category = flag.category;
            const riskLevel = flag.risk_level;

            if (!excerpt || excerpt.length < 10) {
              return highlightByKeywords(category, riskLevel);
            }

            const clean = excerpt.replace(/^["'"]/u, '').replace(/["'"]$/u, '').trim();

            // Strategy 1: Try progressively shorter substrings of the excerpt
            const searchStrategies = [
              clean.toLowerCase(),                          // full excerpt
              clean.slice(0, 120).toLowerCase(),            // first 120 chars
              clean.slice(0, 80).toLowerCase(),             // first 80 chars
              clean.slice(0, 60).toLowerCase(),             // first 60 chars
              clean.slice(0, 40).toLowerCase(),             // first 40 chars
              // Also try splitting by punctuation for embedded phrases
              ...clean.toLowerCase().split(/[.,;]/).map(s => s.trim()).filter(s => s.length > 15)
            ];

            for (const searchText of searchStrategies) {
              if (searchText.length < 8) continue;

              const result = searchAndHighlight(searchText, riskLevel);
              if (result > 0) {
                return result;
              }
            }

            // Only use keyword fallback if excerpt matching completely failed
            return highlightByKeywords(category, riskLevel, clean);
          }

          function searchAndHighlight(searchText, riskLevel) {
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode(node) {
                  const parent = node.parentElement;
                  if (!parent) return NodeFilter.FILTER_REJECT;
                  if (['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'NOSCRIPT'].includes(parent.tagName))
                    return NodeFilter.FILTER_REJECT;
                  if (parent.closest('.yourTerms-highlight,.yourTerms-badge'))
                    return NodeFilter.FILTER_REJECT;
                  return NodeFilter.FILTER_ACCEPT;
                }
              }
            );

            const nodes = [];
            let node;
            while ((node = walker.nextNode())) nodes.push(node);

            for (const textNode of nodes) {
              const content = textNode.textContent || '';
              const idx = content.toLowerCase().indexOf(searchText);
              if (idx === -1) continue;

              const matchLength = Math.min(200, content.length - idx);
              const before = content.slice(0, idx);
              const match = content.slice(idx, idx + matchLength);
              const after = content.slice(idx + matchLength);

              const mark = document.createElement('mark');
              mark.className = 'yourTerms-highlight';
              mark.setAttribute('data-risk', riskLevel);
              mark.textContent = match;

              const frag = document.createDocumentFragment();
              if (before) frag.appendChild(document.createTextNode(before));
              frag.appendChild(mark);
              if (after) frag.appendChild(document.createTextNode(after));

              textNode.parentNode.replaceChild(frag, textNode);
              return 1;
            }
            return 0;
          }

          function highlightByKeywords(category, riskLevel, excerptText) {
            const keywords = CATEGORY_KEYWORDS[category] || [];
            if (keywords.length === 0) return 0;

            // find paragraph with words from the text
            const excerptWords = (excerptText || '').toLowerCase().split(/\s+/).filter(w => w.length > 4);

            const paragraphs = Array.from(document.querySelectorAll('p, li'))
              .filter(el => {
                const text = (el.innerText || el.textContent || '').trim();
                if (text.length < 80 || text.length > 2000) return false;
                if (el.querySelector('.yourTerms-highlight')) return false;
                if (!text.includes('.')) return false;
                return keywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
              });

            if (paragraphs.length === 0) return 0;

            // score paragraphs
            let bestPara = paragraphs[0];
            let bestScore = 0;

            for (const para of paragraphs) {
              const pText = (para.innerText || para.textContent || '').toLowerCase();
              let score = 0;
              for (const w of excerptWords) {
                if (pText.includes(w)) score++;
              }
              // Also count keyword matches
              for (const kw of keywords) {
                if (pText.includes(kw.toLowerCase())) score++;
              }
              if (score > bestScore) {
                bestScore = score;
                bestPara = para;
              }
            }

            // Only highlight if we have reasonable confidence (at least 2 matches)
            if (bestScore < 2) return 0;

            const text = (bestPara.innerText || bestPara.textContent || '').trim();
            const matchedKeyword = keywords.find(kw => text.toLowerCase().includes(kw.toLowerCase()));
            if (!matchedKeyword) return 0;

            const idx = text.toLowerCase().indexOf(matchedKeyword.toLowerCase());
            if (idx === -1) return 0;

            let sentenceStart = text.lastIndexOf('.', idx);
            sentenceStart = sentenceStart === -1 ? 0 : sentenceStart + 1;
            let sentenceEnd = text.indexOf('.', idx + matchedKeyword.length);
            sentenceEnd = sentenceEnd === -1 ? Math.min(idx + 150, text.length) : sentenceEnd + 1;
            const sentence = text.slice(sentenceStart, sentenceEnd).trim();

            return searchAndHighlight(sentence.slice(0, 80).toLowerCase(), riskLevel);
          }

          // Highlight all flags
          let total = 0;
          for (const flag of flags) {
            total += findAndHighlight(flag);
          }

          // Show badge
          const existing = document.getElementById('yourTerms-page-badge');
          if (existing) existing.remove();

          if (total > 0) {
            const badge = document.createElement('div');
            badge.className = 'yourTerms-badge';
            badge.id = 'yourTerms-page-badge';
            badge.innerHTML = `yourTerms · ${total} clause${total !== 1 ? 's' : ''} highlighted`;
            badge.addEventListener('click', () => {
              const first = document.querySelector('.yourTerms-highlight');
              if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
            document.body.appendChild(badge);
          } else {
            const badge = document.createElement('div');
            badge.className = 'yourTerms-badge';
            badge.id = 'yourTerms-page-badge';
            badge.style.background = '#6D28D9';
            badge.innerHTML = `yourTerms · ${flags.length} issue${flags.length !== 1 ? 's' : ''} found (see popup for details)`;
            badge.addEventListener('click', () => badge.remove());
            document.body.appendChild(badge);
          }

          return total;
        },
        args: [state.flags, state.riskLevel]
      });
    }
  } catch (err) {
    console.warn('[yourTerms] Highlighting failed:', err);
  }
}

// start the app
async function init() {
  try {
    // Seed popular T&C cache from bundled JSON
    seedPopularCache().catch(() => { });

    // Load saved settings into settings form
    if (chrome.storage?.sync) {
      chrome.storage.sync.get({
         geminiKey: ''
      }, vals => {
        if (dom.geminiKey) dom.geminiKey.value = vals.geminiKey;
      });
    }

    // Query active tab
    if (!chrome.tabs?.query) {
      document.querySelector('.idle-view__title').textContent = 'Browser page';
      document.querySelector('.idle-view__subtitle').textContent = "yourTerms can only analyse web pages. Navigate to a site's Terms & Conditions or Privacy Policy.";
      showView('idle');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      document.querySelector('.idle-view__title').textContent = 'Browser page';
      document.querySelector('.idle-view__subtitle').textContent = "yourTerms can only analyse web pages. Navigate to a site's Terms & Conditions or Privacy Policy.";
      showView('idle');
      return;
    }

    const domain = extractDomain(tab.url || '');
    dom.headerDomain.textContent = domain || '—';

    // Check if this is a restricted page
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') ||
      tab.url?.startsWith('edge://') || tab.url?.startsWith('about:')) {
      document.querySelector('.idle-view__title').textContent = 'Browser page';
      document.querySelector('.idle-view__subtitle').textContent = "yourTerms can only analyse web pages. Navigate to a site's Terms & Conditions or Privacy Policy.";
      showView('idle');
      return;
    }

    // Ask content script for the page text (with retry for slow-loading pages)
    let extracted;
    let retries = 3;
    let scriptInjected = false;

    while (retries > 0) {
      try {
        extracted = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_TEXT' });
        break; // Success!
      } catch (err) {
        retries--;

        if (retries === 2 && !scriptInjected) {
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: async () => {
                // Wait for dynamic content to load
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Inline extraction function
                const url = window.location.href.toLowerCase();
                const title = document.title || '';
                const h1 = document.querySelector('h1')?.textContent || '';

                const TC_URL_PATTERNS = [/\/terms/i, /\/tos\b/i, /\/conditions/i, /\/legal/i, /\/privacy/i, /\/policy/i];
                const QUERY_TC_PATTERNS = [/\bterms\b/i, /\bprivacy\b/i, /\bpolicy\b/i, /\blegal\b/i, /\bconditions\b/i, /\btos\b/i, /\beula\b/i];
                const isTC = TC_URL_PATTERNS.some(rx => rx.test(url)) ||
                  QUERY_TC_PATTERNS.some(rx => rx.test(window.location.search.toLowerCase())) ||
                  /privacy\s+policy/i.test(title) ||
                  /privacy\s+policy/i.test(h1);

                if (!isTC) return { isTC: false, text: '', url: window.location.href, domain: '', title: '', wordCount: 0 };

                // Extract text - try multiple strategies for dynamic content
                const SKIP = 'nav,header,footer,aside,script,style,noscript,[role="navigation"],[role="banner"],.nav,.menu,.header,.footer,[class*="navigation"],[class*="sidebar"]';
                const clone = document.body.cloneNode(true);
                clone.querySelectorAll(SKIP).forEach(el => el.remove());

                // Try multiple selectors for main content
                let main = clone.querySelector('main') ||
                  clone.querySelector('[role="main"]') ||
                  clone.querySelector('article') ||
                  clone.querySelector('[class*="legal"]') ||
                  clone.querySelector('[class*="policy"]') ||
                  clone.querySelector('[id*="legal"]') ||
                  clone.querySelector('[id*="policy"]');

                // If main container is too small, use body
                if (!main || (main.innerText || main.textContent || '').trim().length < 500) {
                  main = clone;
                }

                let text = (main.innerText || main.textContent || '')
                  .replace(/\t+/g, ' ')
                  .replace(/ {3,}/g, ' ')
                  .replace(/\n{4,}/g, '\n\n\n')
                  .trim();

                // Shadow DOM fallback: TikTok renders inside shadow roots
                const wc = text.split(/\s+/).filter(w => w.length > 0).length;
                if (wc < 200) {
                  const shadowTexts = [];
                  function walkShadow(node) {
                    if (!node) return;
                    if (node.shadowRoot) {
                      const t = (node.shadowRoot.innerText || node.shadowRoot.textContent || '').trim();
                      if (t.length > 100) shadowTexts.push(t);
                      Array.from(node.shadowRoot.children || []).forEach(walkShadow);
                    }
                    Array.from(node.children || []).forEach(walkShadow);
                  }
                  walkShadow(document.body);
                  if (shadowTexts.length > 0) {
                    const best = shadowTexts.sort((a, b) => b.length - a.length)[0];
                    if (best.length > text.length) text = best;
                  }
                }

                return {
                  isTC: true,
                  text,
                  url: window.location.href,
                  domain: window.location.hostname.replace(/^www\./, ''),
                  title: document.title,
                  wordCount: text.split(/\s+/).filter(w => w.length > 0).length
                };
              }
            });

            if (results && results[0]?.result) {
              extracted = results[0].result;
              scriptInjected = true;
              break; // Success!
            }
          } catch (injectErr) {
            console.warn('[yourTerms] Inline extraction failed:', injectErr);
          }
        }

        if (retries > 0) {
          await tick(400);
        } else {
          // Content script not injected or page blocked extension
          console.warn('[yourTerms] Failed to extract text after retries:', err);
          // Check if it's a restricted page
          if (err.message?.includes('Cannot access') || err.message?.includes('Receiving end does not exist')) {
            dom.headerDomain.textContent = 'Unavailable';
            // Show retry button for T&C pages that might be slow to load
            if (domain && (domain.includes('tiktok') || domain.includes('legal') || domain.includes('privacy'))) {
              dom.btnRetry.style.display = 'block';
            }
          }
          document.querySelector('.idle-view__title').textContent = 'Page unavailable';
          document.querySelector('.idle-view__subtitle').textContent = "yourTerms couldn't read this page. It may be restricted or blocked. Try the paste area below.";
          showView('idle');
          return;
        }
      }
    }

    // Restore domain name
    dom.headerDomain.textContent = domain || '—';

    if (!extracted?.isTC) {
      console.log('[yourTerms] Not a T&C page');
      document.querySelector('.idle-view__title').textContent = 'Not a T&C page';
      document.querySelector('.idle-view__subtitle').textContent = "This page doesn't appear to contain Terms & Conditions or a Privacy Policy. Try navigating directly to a legal page.";
      showView('idle');
      return;
    }

    if (!extracted.text || extracted.text.length < 100) {
      console.warn('[yourTerms] Text too short:', extracted.text?.length || 0, 'chars');

      // Show retry button for dynamic content sites
      if (domain && (domain.includes('tiktok') || domain.includes('legal') || domain.includes('privacy'))) {
        dom.btnRetry.style.display = 'block';
      }

      showError('This page loads content dynamically. Click "Try again" below after the page fully loads, or copy and paste the text manually.');
      return;
    }

    // Auto-start analysis
    await runAnalysis(extracted.text, extracted.url, extracted.domain);
  } catch (err) {
    console.error('Init error:', err);
    showError(err.message || 'Failed to initialize yourTerms');
  }
}

function showError(msg) {
  showView('results');
  dom.flagsContainer.innerHTML = `
    <div class="state-card state-card--error" style="margin:var(--space-4)">
      <p class="state-card__title">Analysis failed</p>
      <p class="state-card__body">${escapeHtml(msg)}</p>
    </div>
    <p style="font-size:var(--text-sm);color:var(--text-tertiary);padding:0 var(--space-4)">
      Check your API key in Settings, or paste the T&C text manually.
    </p>`;
  dom.riskScore.textContent = '—';
  dom.headerBadge.style.display = 'none';
}

// DOM Event bindings
// Paste textarea → enable analyse button
dom.pasteInput?.addEventListener('input', () => {
  dom.btnAnalysePaste.disabled = dom.pasteInput.value.trim().length < 100;
});

// Analyse pasted text
dom.btnAnalysePaste?.addEventListener('click', async () => {
  const text = dom.pasteInput.value.trim();
  if (!text) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = extractDomain(tab?.url || 'unknown');
  const url = tab?.url || 'paste://manual';
  try {
    await runAnalysis(text, url, domain);
  } catch (err) {
    showError(err.message);
  }
});

// Chat input: open chat view on focus if not already open
dom.chatInput?.addEventListener('focus', () => {
  if (state.currentView !== 'chat' && ['results'].includes(state.currentView) && state.tcText) {
    showView('chat');
  }
});

// Chat input: auto-grow + enable send
dom.chatInput?.addEventListener('input', () => {
  dom.chatInput.style.height = 'auto';
  dom.chatInput.style.height = Math.min(dom.chatInput.scrollHeight, 100) + 'px';
  dom.sendBtn.disabled = dom.chatInput.value.trim().length === 0;
});

// Enter to send (Shift+Enter = newline)
dom.chatInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!dom.sendBtn.disabled) sendChatMessage(dom.chatInput.value.trim());
  }
});

// Send button
dom.sendBtn?.addEventListener('click', () => {
  sendChatMessage(dom.chatInput.value.trim());
});

// Back button (chat → results)
dom.backBtn?.addEventListener('click', () => showView('results'));

// Open generic chat button
document.getElementById('btn-open-chat')?.addEventListener('click', () => {
  if (state.tcText) {
    showView('chat');
  }
});

// Settings toggle
dom.settingsBtn?.addEventListener('click', () => {
  showView(state.currentView === 'settings' ? (state.flags.length > 0 ? 'results' : 'idle') : 'settings');
});

// View on page — scroll to first highlight
document.getElementById('btn-highlight')?.addEventListener('click', async () => {
  await triggerPageHighlight();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      // Try content script first
      await chrome.tabs.sendMessage(tab.id, { type: 'SCROLL_TO_FIRST' });
    } catch {
      // Fallback: inject inline scroll
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const first = document.querySelector('.yourTerms-highlight');
          if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }
  window.close(); // Close popup so user can see the highlighted page
});

// Force a fresh AI analysis using the already-extracted text.
// We deliberately do NOT re-extract the page on re-analyze — dynamic page elements
// (cookie banners, timestamps, lazy sections) make extraction non-deterministic,
// so re-extraction produces different flaggedParagraphs → different score each run.
// Re-analyze refreshes the AI opinion on the same document, not the page read.
document.getElementById('btn-reanalyse')?.addEventListener('click', async () => {
  if (state.urlHash) {
    await clearLocalCache(state.urlHash, state.domain);
  }
  try {
    const textToAnalyze = state.tcText;
    if (!textToAnalyze) throw new Error("No text available to re-analyse. Please close and reopen the extension.");

    await runAnalysis(textToAnalyze, state.tcUrl, state.domain, true);
  } catch (err) {
    showError(err.message);
  }
});

// Save API keys
dom.saveKeysBtn?.addEventListener('click', () => {
  const keys = {
    geminiKey: dom.geminiKey?.value.trim() || '',
  };

  chrome.runtime.sendMessage({ type: 'SAVE_KEYS', keys }, () => {
    dom.settingsSaved?.classList.add('visible');
    setTimeout(() => dom.settingsSaved?.classList.remove('visible'), 2500);
  });
});

// Retry button - re-run init with longer delay for dynamic content
dom.btnRetry?.addEventListener('click', async () => {
  dom.btnRetry.style.display = 'none';
  dom.btnRetry.disabled = true;
  dom.btnRetry.textContent = 'Loading...';

  // Wait a bit longer for dynamic content
  await tick(1000);

  dom.btnRetry.textContent = 'Try again';
  dom.btnRetry.disabled = false;
  init().catch(console.error);
});

// Shared utility functions
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function tick(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

init().catch(console.error);
