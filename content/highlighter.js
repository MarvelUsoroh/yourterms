// content/highlighter.js
// In-page clause highlighter.
// When the popup sends HIGHLIGHT_CLAUSES, this script wraps matching text
// in <mark> elements directly on the T&C page so users can see exactly
// where flagged clauses live in their original context.
(function () {
  'use strict';

  // Prevent double-injection
  if (window.__yourTermsHighlighterActive) return;
  window.__yourTermsHighlighterActive = true;

  // Injected CSS variables
  // We inject styles dynamically because content scripts run in an isolated environment 
  // but their UI additions (like the highlight <mark>) share the page's styling context.
  const STYLE_ID = 'yourTerms-highlight-styles';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .yourTerms-highlight {
        background: rgba(109, 40, 217, 0.12) !important;
        border-bottom: 2px solid rgba(109, 40, 217, 0.7) !important;
        border-radius: 2px !important;
        cursor: pointer !important;
        position: relative !important;
        transition: background 0.15s ease !important;
      }
      .yourTerms-highlight:hover {
        background: rgba(109, 40, 217, 0.22) !important;
      }
      .yourTerms-highlight[data-risk="high"] {
        background: rgba(192, 40, 14, 0.10) !important;
        border-bottom-color: rgba(192, 40, 14, 0.7) !important;
      }
      .yourTerms-highlight[data-risk="high"]:hover {
        background: rgba(192, 40, 14, 0.18) !important;
      }
      .yourTerms-highlight[data-risk="medium"] {
        background: rgba(180, 83, 9, 0.10) !important;
        border-bottom-color: rgba(180, 83, 9, 0.7) !important;
      }
      .yourTerms-highlight[data-risk="medium"]:hover {
        background: rgba(180, 83, 9, 0.18) !important;
      }
      .yourTerms-tooltip {
        position: fixed !important;
        z-index: 2147483647 !important;
        background: #1A1917 !important;
        color: #F0EFEB !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        font-size: 12px !important;
        line-height: 1.5 !important;
        padding: 10px 14px !important;
        border-radius: 8px !important;
        max-width: 280px !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.35) !important;
        pointer-events: none !important;
        opacity: 0 !important;
        transition: opacity 0.15s ease !important;
      }
      .yourTerms-tooltip.visible { opacity: 1 !important; }
      .yourTerms-tooltip__category {
        font-size: 10px !important;
        font-weight: 600 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.06em !important;
        margin-bottom: 4px !important;
        color: #A78BFA !important;
      }
      .yourTerms-tooltip__risk {
        display: inline-block !important;
        font-size: 10px !important;
        font-weight: 600 !important;
        padding: 1px 6px !important;
        border-radius: 999px !important;
        margin-bottom: 6px !important;
      }
      .yourTerms-tooltip__risk--high   { background: rgba(192,40,14,0.3)!important; color: #FC8A7C !important; }
      .yourTerms-tooltip__risk--medium { background: rgba(180,83,9,0.3)!important;  color: #FCD34D !important; }
      .yourTerms-tooltip__risk--low    { background: rgba(26,127,75,0.3)!important;  color: #34D399 !important; }
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
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        transition: opacity 0.2s ease !important;
      }
      .yourTerms-badge:hover { opacity: 0.85 !important; }
      .yourTerms-badge__dot {
        width: 7px !important;
        height: 7px !important;
        border-radius: 50% !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Floating Tooltip
  // Used to display the exact AI explanation and risk score when a user hovers over 
  // a highlighted snippet. Positioned absolutely to avoid layout shifts.
  const tooltip = document.createElement('div');
  tooltip.className = 'yourTerms-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('aria-live', 'polite');
  document.body.appendChild(tooltip);

  function showTooltip(el, flag) {
    const RISK_LABELS = { high: 'High risk', medium: 'Medium risk', low: 'Low risk' };
    const CAT_LABELS = {
      UNILATERAL_CHANGE: 'Unilateral Change',
      UNILATERAL_TERMINATION: 'Unilateral Termination',
      LIMITATION_OF_LIABILITY: 'Limitation of Liability',
      CONTENT_OWNERSHIP: 'Content Ownership',
      JURISDICTION: 'Jurisdiction',
    };

    tooltip.innerHTML = `
      <div class="yourTerms-tooltip__category">yourTerms · ${CAT_LABELS[flag.category] || flag.category}</div>
      <div class="yourTerms-tooltip__risk yourTerms-tooltip__risk--${flag.risk_level}">
        ${RISK_LABELS[flag.risk_level]}
      </div>
      <div>${flag.explanation}</div>
      ${flag.gdpr_article ? `<div style="margin-top:6px;font-size:10px;color:#6B6A66">${flag.gdpr_article}</div>` : ''}
    `;

    const rect = el.getBoundingClientRect();
    const tt_w = 280;
    let left = rect.left;
    let top = rect.bottom + 8;

    // Keep inside viewport
    if (left + tt_w > window.innerWidth) left = window.innerWidth - tt_w - 16;
    if (left < 8) left = 8;
    if (top + 140 > window.innerHeight) top = rect.top - 148;

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.classList.add('visible');
  }

  function hideTooltip() {
    tooltip.classList.remove('visible');
  }

  // DOM traversal and wrapping
  // Instead of using innerHTML (which breaks event listeners on modern SPA frameworks like React/Vue),
  // we use a TreeWalker to find pure TextNodes, split them, and insert a <mark> element natively.
  // This guarantees we don't break the page's underlying application logic.
  let highlightCount = 0;

  function findAndWrap(excerpt, flagData) {
    if (!excerpt || excerpt.length < 10) return 0;

    // Strip surrounding quotes from the excerpt
    const clean = excerpt.replace(/^["'"]/u, '').replace(/["'"]$/u, '').trim();
    // Use first 60 chars for matching (excerpt may be truncated)
    const searchText = clean.slice(0, 60).toLowerCase();
    if (searchText.length < 8) return 0;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          // Skip already-highlighted, scripts, styles, inputs
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'NOSCRIPT'].includes(parent.tagName))
            return NodeFilter.FILTER_REJECT;
          if (parent.closest('.yourTerms-highlight,.yourTerms-tooltip,.yourTerms-badge'))
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let found = 0;
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    for (const textNode of nodes) {
      const content = textNode.textContent || '';
      const idx = content.toLowerCase().indexOf(searchText);
      if (idx === -1) continue;

      // Split the text node around the match
      const matchLength = Math.min(clean.length, content.length - idx);
      const before = content.slice(0, idx);
      const match = content.slice(idx, idx + matchLength);
      const after = content.slice(idx + matchLength);

      const mark = document.createElement('mark');
      mark.className = 'yourTerms-highlight';
      mark.setAttribute('data-risk', flagData.risk_level);
      mark.setAttribute('tabindex', '0');
      mark.setAttribute('role', 'mark');
      mark.setAttribute('aria-label', `yourTerms flagged: ${flagData.explanation}`);
      mark.textContent = match;

      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(mark);
      if (after) frag.appendChild(document.createTextNode(after));

      textNode.parentNode.replaceChild(frag, textNode);

      // Attach tooltip events
      mark.addEventListener('mouseenter', () => showTooltip(mark, flagData));
      mark.addEventListener('mouseleave', hideTooltip);
      mark.addEventListener('focus', () => showTooltip(mark, flagData));
      mark.addEventListener('blur', hideTooltip);

      found++;
      break; // One highlight per flag to avoid overwhelming the page
    }

    return found;
  }

  // Status Badge
  // A persistent floating indicator that reminds the user how many issues were found,
  // providing a quick anchor back to the top-most highlighted issue.
  function showBadge(count, level) {
    const existing = document.getElementById('yourTerms-page-badge');
    if (existing) existing.remove();

    const COLORS = { safe: '#34D399', caution: '#FCD34D', danger: '#FC8A7C' };
    const badge = document.createElement('div');
    badge.className = 'yourTerms-badge';
    badge.id = 'yourTerms-page-badge';
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-label', `yourTerms found ${count} flagged clause${count !== 1 ? 's' : ''}`);
    badge.innerHTML = `
      <span class="yourTerms-badge__dot" style="background:${COLORS[level] || '#FCD34D'}"></span>
      yourTerms · ${count} clause${count !== 1 ? 's' : ''} flagged
    `;
    badge.addEventListener('click', () => {
      const first = document.querySelector('.yourTerms-highlight');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    document.body.appendChild(badge);
  }

  // Clean up
  // Ensures idempotency by removing all injected marks and badges before a new analysis pass.
  function clearHighlights() {
    document.querySelectorAll('.yourTerms-highlight').forEach(el => {
      const text = document.createTextNode(el.textContent);
      el.parentNode.replaceChild(text, el);
    });
    document.getElementById('yourTerms-page-badge')?.remove();
    highlightCount = 0;
    hideTooltip();
  }

  // Event listener for popup triggers
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'HIGHLIGHT_CLAUSES') {
      clearHighlights();
      const { flags, riskLevel } = message;

      if (!flags || flags.length === 0) {
        sendResponse({ highlighted: 0 });
        return;
      }

      let total = 0;
      for (const flag of flags) {
        if (flag.excerpt) {
          total += findAndWrap(flag.excerpt, flag);
        }
      }

      highlightCount = total;
      if (total > 0) showBadge(total, riskLevel);
      sendResponse({ highlighted: total });
      return true;
    }

    if (message.type === 'CLEAR_HIGHLIGHTS') {
      clearHighlights();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'SCROLL_TO_FIRST') {
      const first = document.querySelector('.yourTerms-highlight');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sendResponse({ found: !!first });
    }
  });

})();
