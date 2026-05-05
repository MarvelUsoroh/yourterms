// lib/keywords.js
// keywords to look for
export const CATEGORIES = {
  UNILATERAL_CHANGE: {
    id: 'UNILATERAL_CHANGE',
    label: 'Unilateral Change',
    gdpr: 'Art. 5 & 13',
    description: 'Provider can change terms without meaningful notice',
    pillClass: 'pill--change',
  },
  UNILATERAL_TERMINATION: {
    id: 'UNILATERAL_TERMINATION',
    label: 'Unilateral Termination',
    gdpr: 'Art. 21',
    description: 'Provider can suspend or terminate accounts without reason',
    pillClass: 'pill--terminate',
  },
  LIMITATION_OF_LIABILITY: {
    id: 'LIMITATION_OF_LIABILITY',
    label: 'Limitation of Liability',
    gdpr: 'Art. 82',
    description: 'Provider disclaims responsibility for data loss or damage',
    pillClass: 'pill--liability',
  },
  CONTENT_OWNERSHIP: {
    id: 'CONTENT_OWNERSHIP',
    label: 'Content Ownership',
    gdpr: 'Art. 17',
    description: 'Provider claims broad license or ownership of user content',
    pillClass: 'pill--ownership',
  },
  JURISDICTION: {
    id: 'JURISDICTION',
    label: 'Jurisdiction',
    gdpr: 'Art. 77',
    description: 'Requires specific legal venue disadvantageous to user',
    pillClass: 'pill--jurisdiction',
  },
};

// lists of keywords for each category
export const KEYWORD_PATTERNS = {
  UNILATERAL_CHANGE: [
    /\breserve[s]?\s+the\s+right\b/i,
    /\bat\s+(our\s+)?sole\s+discretion\b/i,
    /\bwithout\s+notice\b/i,
    /\bmay\s+(change|modify|update|amend|revise)\b/i,
    // matches terms and policies
    /\b(change|modify|update|amend|revise)\s+(these?|this|our|the|any)?\s*(\w+\s+)?(terms|policy|agreement|conditions|notice)\b/i,
    /\bat\s+any\s+time\b/i,
    /\beffective\s+(immediately|upon\s+posting)\b/i,
    /\bcontinued\s+use\s+(of|constitutes)\b/i,
    /\bdeemed\s+acceptance\b/i,
    // privacy policy words
    /\bfrom\s+time\s+to\s+time\s+(we\s+may|we\s+will|this\s+policy)\b/i,
    /\bwe\s+may\s+update\s+(this|our)\s+privacy\b/i,
    /\bif\s+we\s+make\s+(material\s+)?changes\b/i,
    /\bby\s+continuing\s+to\s+(use|access)\s+(our\s+)?(services|platform)\b/i,
    // google and meta words
    /\b(we|company|google|youtube|meta|facebook)\s+are\s+constantly\s+(changing|improving)\b/i,
    /\b(we|company|google|youtube|meta|facebook)\s+(can|may)\s+(change|modify|update|amend|revise|stop)\b/i,
  ],
  UNILATERAL_TERMINATION: [
    /\bterminate[s]?\s+(your\s+)?(account|access|service)\b/i,
    /\bsuspend[s]?\s+(your\s+)?(account|access|service)\b/i,
    /\bdisable[s]?\s+(your\s+)?account\b/i,
    /\bremove[s]?\s+(your\s+)?access\b/i,
    /\bban\s+(you|users|accounts)\b/i,
    /\bwithout\s+(reason|cause|prior\s+notice|warning|explanation)\b/i,
    /\bdiscontinue\s+(the\s+)?(service|platform)\b/i,
    /\btermination\s+for\s+(convenience|any\s+reason)\b/i,
    /\bwithout\s+liability\s+to\s+(you|users)\b/i,
    // google and meta words
    /\bstop\s+providing\s+(part\s+or\s+all\s+of\s+)?the\s+(service|platform)\b/i,
    /\bif\s+we\s+reasonably\s+believe\b/i,
    /\btake\s+down\s+(your\s+)?content\b/i,
  ],
  LIMITATION_OF_LIABILITY: [
    /\bnot\s+liable\b/i,
    /\bno\s+liability\b/i,
    /\bdisclaim[s]?\b/i,
    /\bprovided\s+"?as.?is"?\b/i,
    /\bno\s+warranty\b/i,
    /\bwithout\s+warranty\b/i,
    /\bto\s+the\s+(fullest?|maximum)\s+extent\s+permitted\b/i,
    /\bin\s+no\s+event\s+(shall|will|are)\b/i,
    /\bexclude[s]?\s+(all\s+)?(liability|warranties)\b/i,
    /\bindirect,\s*incidental,\s*special\b/i,
    /\bloss\s+of\s+data\b/i,
  ],
  CONTENT_OWNERSHIP: [
    /\birrevocable\b/i,
    /\bperpetual\b/i,
    /\broyalty.?free\b/i,
    /\bworldwide\s+license\b/i,
    /\blicense\s+to\s+(use|host|store|reproduce|modify|create)\b/i,
    /\bsublicense\b/i,
    /\bown\s+(all\s+)?(intellectual\s+property|content|data)\b/i,
    /\bassign[s]?\s+(all\s+)?rights\b/i,
    /\bwaive[s]?\s+(all\s+)?(moral\s+)?rights\b/i,
    /\bgrant\s+(us|company).{0,30}license\b/i,
    // privacy policy words
    /\bshare\s+(your\s+)?(personal\s+)?(information|data)\s+with\b/i,
    /\bsell\s+(your\s+)?(personal\s+)?(information|data)\b/i,
    /\btransfer\s+(your\s+)?(personal\s+)?(information|data)\b/i,
    /\bbiometric\b/i,
    /\bdisclose\s+(your\s+)?(personal\s+)?(information|data)\b/i,
    /\bwe\s+collect\s+(information|data)\b/i,
    /\b(information|data)\s+we\s+receive\b/i,
    /\bshare\s+information\s+with\s+(third\s+parties|partners|affiliates)\b/i,
    /\bretain\s+(your\s+)?(information|data)\b/i,
    /\bcombine\s+(your\s+)?(information|data)\b/i,
  ],
  JURISDICTION: [
    /\bexclusive\s+jurisdiction\b/i,
    /\bgoverning\s+law\b/i,
    /\bjurisdiction\s+(of|in|shall\s+be)\b/i,
    /\barbitration\b/i,
    /\bclass\s+action\s+waiver\b/i,
    /\bwaive[s]?\s+(your\s+)?right\s+to\s+(a\s+)?jury\b/i,
    /\bdispute\s+resolution\b/i,
    /\bbinding\s+arbitration\b/i,
    /\bsmall\s+claims\s+court\b/i,
    /\bventure\s+in\s+the\s+state\s+of\b/i,
    /\bmust\s+be\s+brought\s+in\b/i,
    /\bsubmit\s+to\s+the\s+(personal\s+)?jurisdiction\b/i,
    // privacy policy words
    /\btransfer\s+(your\s+)?data\s+(to|outside|across)\b/i,
    /\bstandard\s+contractual\s+clauses\b/i,
    /\btransfer.*outside.*(EEA|European Economic Area|European Union)\b/i,
    /\b(processed|stored)\s+in\s+the\s+(united\s+states|us|u\.s\.)\b/i,
    /\bglobal\s+(operations|infrastructure)\b/i,
    /\binternational\s+data\s+transfers\b/i,
  ],
};

/**
 * split text into paragraphs
 */
function splitIntoParagraphs(text) {
  const byDouble = text
    .split(/\n{2,}|\r\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length >= 30);

  // fallback for sites with weird spacing
  let splits = byDouble;
  if ((byDouble.length < 15 && text.length > 500) || byDouble.some(p => p.length > 1000)) {
    splits = text
      .split(/\n/)
      .map(p => p.replace(/\s+/g, ' ').trim())
      .filter(p => p.length >= 30);
  }

  // second fallback if text is still too long
  const MAX_PARA_CHARS = 2000;
  const finalSplits = [];
  let currentPara = "";
  
  for (const block of splits) {
    if (block.length <= MAX_PARA_CHARS) {
      finalSplits.push(block);
    } else {
      // split by sentences
      const sentences = block.split(/(?<=\.)\s+/);
      
      for (const sentence of sentences) {
        if (currentPara.length + sentence.length > MAX_PARA_CHARS && currentPara.length > 0) {
          finalSplits.push(currentPara.trim());
          currentPara = sentence;
        } else {
          currentPara += (currentPara ? " " : "") + sentence;
        }
      }
      if (currentPara) {
        finalSplits.push(currentPara.trim());
      }
    }
  }

  return finalSplits;
}

/**
 * check if text has any keywords
 */
function matchesCategory(paragraph, categoryId) {
  const patterns = KEYWORD_PATTERNS[categoryId];
  return patterns.some(rx => rx.test(paragraph));
}

/**
 * find paragraphs with keywords and keep the ones around them
 *
 * @param {string} text
 * @returns {{ flaggedParagraphs: object[], stats: object }}
 */
export function preFilter(text) {
  const paragraphs = splitIntoParagraphs(text);
  const matchedIndices = new Set();
  const categoryHits = {};

  // 1. find keywords
  for (let i = 0; i < paragraphs.length; i++) {
    const matchedCategories = [];
    for (const categoryId of Object.keys(KEYWORD_PATTERNS)) {
      if (matchesCategory(paragraphs[i], categoryId)) {
        matchedCategories.push(categoryId);
        categoryHits[categoryId] = (categoryHits[categoryId] || 0) + 1;
      }
    }
    if (matchedCategories.length > 0) {
      // keep neighbor paragraphs
      matchedIndices.add(i);
      if (i < paragraphs.length - 1) matchedIndices.add(i + 1);
    }
  }

  // 2. merge together
  const chunks = [];
  const sortedIndices = Array.from(matchedIndices).sort((a, b) => a - b);
  let i = 0;
  while (i < sortedIndices.length) {
    let j = i;
    // merge consecutive
    while (j + 1 < sortedIndices.length && sortedIndices[j + 1] === sortedIndices[j] + 1) {
      j++;
    }
    const chunkText = sortedIndices.slice(i, j + 1).map(idx => paragraphs[idx]).join('\n\n');
    chunks.push({ text: chunkText, hintCategories: Object.keys(categoryHits) });
    i = j + 1;
  }

  return {
    flaggedParagraphs: chunks,
    stats: {
      total: paragraphs.length,
      flagged: chunks.length,
      categoryHits,
      reductionPct: Math.round((1 - chunks.length / Math.max(paragraphs.length, 1)) * 100),
    },
  };
}

