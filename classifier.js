function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, () => []);
  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a, b) {
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

function preprocessDomainKeywords(rules) {
  const map = rules?.logic?.domain_classification_keywords || {};
  const processed = {};
  for (const [domain, keywords] of Object.entries(map)) {
    const entry = { regex: [], words: [] };
    for (const kw of keywords) {
      if (kw.startsWith('/') && kw.endsWith('/')) {
        entry.regex.push(new RegExp(kw.slice(1, -1), 'i'));
      } else {
        entry.words.push(normalize(kw));
      }
    }
    processed[domain] = entry;
  }
  rules._domainKeywords = processed;
}

function classifyDomain(text, r = rules) {
  const map = r?._domainKeywords || {};
  const normText = normalize(text);
  const tokens = normText.split(/\s+/);
  let best = { domain: 'outro', score: 0 };
  for (const [domain, entry] of Object.entries(map)) {
    for (const re of entry.regex) {
      if (re.test(normText)) return { domain, confidence: 1 };
    }
    for (const kw of entry.words) {
      if (normText.includes(kw)) return { domain, confidence: 1 };
      for (const word of tokens) {
        const score = similarity(word, kw);
        if (score > best.score) best = { domain, score };
      }
    }
  }
  return { domain: best.domain, confidence: best.score };
}

if (typeof module !== 'undefined') {
  module.exports = {
    preprocessDomainKeywords,
    classifyDomain,
    normalize,
    similarity,
  };
}
