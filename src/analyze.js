import { THEMES } from './taxonomy.js';

const STOPWORDS = new Set(
  ('a an the and or but of in on at to for from with without by as is are was were be been being this that these those it its into over under after before new now'
    + ' has have had will would can could may might do does did not no than then so such more most other new report reports said says about via amid')
    .split(' '),
);

/** Comparable token set for a headline. */
export function titleTokens(title) {
  return new Set(
    String(title ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** Theme ids whose patterns appear in an item's text. */
export function matchThemes(item) {
  const haystack = `${item.title} ${item.summary || ''} ${(item.categories || []).join(' ')}`;
  const matched = [];
  for (const theme of THEMES) {
    let hits = 0;
    for (const pattern of theme.match) {
      if (pattern.test(haystack)) hits += 1;
    }
    if (hits > 0) matched.push({ id: theme.id, hits });
  }
  // Strongest signal first, so the lead theme of a story is meaningful.
  return matched.sort((a, b) => b.hits - a.hits);
}

const URGENCY_SIGNALS = [
  { pattern: /\b(actively exploited|exploited in the wild|under active (?:attack|exploitation))\b/i, points: 2.6, label: 'Active exploitation' },
  { pattern: /\bzero[- ]day\b/i, points: 2.0, label: 'Zero-day' },
  { pattern: /\b(known exploited vulnerabilit|kev catalog)\b/i, points: 1.8, label: 'CISA KEV' },
  { pattern: /\b(emergency (?:patch|directive|update)|patch now|out-of-band (?:patch|update))\b/i, points: 1.6, label: 'Emergency patch' },
  { pattern: /\b(critical (?:vulnerability|flaw|bug)|cvss (?:9|10)(?:\.\d)?|severity[: ]+critical)\b/i, points: 1.2, label: 'Critical severity' },
  { pattern: /\b(unauthenticated|pre-?auth|remote code execution|rce|wormable)\b/i, points: 1.1, label: 'Unauthenticated RCE' },
  { pattern: /\b\d[\d.,]*\s*(?:million|billion)\s+(?:records|customers|users|accounts|people)\b/i, points: 1.4, label: 'Large-scale data loss' },
  { pattern: /\b(ransomware|extortion)\b/i, points: 0.9, label: 'Extortion' },
  { pattern: /\b(nation-?state|state-?sponsored|espionage)\b/i, points: 0.9, label: 'State-linked' },
  { pattern: /\b(supply chain (?:attack|compromise)|malicious package)\b/i, points: 1.0, label: 'Supply chain' },
  { pattern: /\b(no patch|unpatched|no fix|end of life|eol)\b/i, points: 0.8, label: 'No fix available' },
];

const KIND_BONUS = { authority: 0.8, journalism: 0.3, research: 0.5, practitioner: 0.2 };

/**
 * Editorial ranking. Combines source authority, freshness, explicit urgency
 * language, how many independent outlets carried the story, and the weight of
 * the themes it touches.
 */
export function scoreItem(item, now = Date.now()) {
  const ageHours = item.publishedAt ? Math.max(0, (now - Date.parse(item.publishedAt)) / 3600000) : 48;
  const freshness = 2.4 * Math.exp(-ageHours / 20);

  const haystack = `${item.title} ${item.summary || ''}`;
  const signals = [];
  let urgency = 0;
  for (const signal of URGENCY_SIGNALS) {
    if (signal.pattern.test(haystack)) {
      urgency += signal.points;
      signals.push(signal.label);
    }
  }
  // Headline matches count for more than a passing mention in the body.
  for (const signal of URGENCY_SIGNALS) {
    if (signal.pattern.test(item.title)) urgency += signal.points * 0.35;
  }

  const themeWeight = (item.themes || []).reduce((sum, t) => {
    const theme = THEMES.find((x) => x.id === t.id);
    return sum + (theme ? theme.weight * 0.22 : 0);
  }, 0);

  const corroboration = Math.min(2.4, Math.max(0, (item.alsoReportedBy?.length || 0)) * 1.1);

  // A clipping the reader cannot actually learn anything from is a weaker
  // front-page candidate, however urgent its headline sounds.
  const summaryLength = (item.summary || '').length;
  const thinPenalty = summaryLength < 150 ? 1.3 : summaryLength < 250 ? 0.6 : 0;

  // A structured advisory dump is still worth publishing, just not at the top.
  const readability = (proseScore(item.summary) - 0.6) * 1.1;

  const score =
    item.sourceWeight +
    (KIND_BONUS[item.sourceKind] || 0) +
    freshness +
    Math.min(urgency, 5.5) +
    Math.min(themeWeight, 1.6) +
    corroboration +
    readability -
    thinPenalty;

  return { score: Number(score.toFixed(3)), signals: [...new Set(signals)].slice(0, 4), ageHours };
}

/** CVE identifiers mentioned in a story, as an uppercase set. */
function cveSet(item) {
  const out = new Set();
  const text = `${item.title} ${item.summary || ''}`;
  for (const match of text.matchAll(/\bCVE-\d{4}-\d{4,7}\b/gi)) out.add(match[0].toUpperCase());
  return out;
}

function sharesMember(a, b) {
  for (const value of a) if (b.has(value)) return true;
  return false;
}

/**
 * How readable a summary is as prose.
 *
 * Advisory feeds (national CERTs, vendor PSIRTs) publish structured records -
 * serial numbers, affected version matrices - which flatten into a wall of
 * fragments with almost no sentence structure. They are authoritative and
 * belong in the edition, but they read badly as the front-page clipping when a
 * newsroom covered the same flaw in plain sentences.
 *
 * Returns roughly 1 for narrative prose, and much less for a data dump.
 */
export function proseScore(text) {
  const value = String(text || '');
  if (value.length < 80) return 0.5;

  // Narrative writing lands around 5+ sentence endings per 1000 characters.
  const sentences = (value.match(/[.!?](\s|$)/g) || []).length;
  const density = (sentences / value.length) * 1000;
  const structure = Math.min(1, density / 5);

  // A high digit share means version tables, serial numbers and dates.
  const digits = (value.match(/\d/g) || []).length / value.length;
  const noise = digits > 0.12 ? 0.55 : digits > 0.08 ? 0.8 : 1;

  return Math.max(0.15, structure * noise);
}

/**
 * How suitable a clipping is to represent its cluster.
 *
 * Authority matters, but so does whether the outlet actually gave readers a
 * usable summary: several major publishers emit one-line blurbs and block
 * automated article fetches, and a headline with 40 characters of context is a
 * worse front-page clipping than a rival's full paragraph. Readability is
 * weighed too, so an advisory does not outrank the newsroom write-up of it.
 */
function representativeScore(item) {
  const length = Math.min((item.summary || '').length, 600);
  const prose = proseScore(item.summary);
  return item.sourceWeight + (length / 600) * 1.3 * prose + (prose - 0.5) * 0.9;
}

/**
 * Collapse the same story reported by several outlets into one clipping.
 *
 * Three signals link two stories: the same URL, closely matching headlines, or
 * a shared CVE in two focused reports whose headlines agree on the subject.
 * The last one is what catches the common case of five outlets covering one
 * vulnerability with completely different wording.
 *
 * The best representative becomes the canonical clipping; the rest are kept as
 * corroborating links so nothing is silently dropped.
 */
export function clusterDuplicates(items) {
  const byUrl = new Map();
  for (const item of items) {
    const key = item.dedupeKey || item.url;
    const existing = byUrl.get(key);
    if (!existing || representativeScore(item) > representativeScore(existing)) byUrl.set(key, item);
  }
  const unique = [...byUrl.values()];

  const withTokens = unique.map((item) => ({ item, tokens: titleTokens(item.title), cves: cveSet(item) }));

  /**
   * Distinctive vocabulary: tokens that appear in only a handful of headlines
   * across the corpus. These are the names - actors, victims, products - that
   * identify a specific story, as opposed to common words like "attack" that
   * appear everywhere and carry no identifying power.
   */
  const documentFrequency = new Map();
  for (const entry of withTokens) {
    for (const token of entry.tokens) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  }
  const isDistinctive = (token) => token.length >= 4 && (documentFrequency.get(token) || 0) <= 3;
  const sharedDistinctive = (a, b) => {
    let count = 0;
    for (const token of a) if (b.has(token) && isDistinctive(token)) count += 1;
    return count;
  };

  // Inverted index so we only compare headlines that share vocabulary.
  const index = new Map();
  withTokens.forEach((entry, i) => {
    for (const token of entry.tokens) {
      if (!index.has(token)) index.set(token, []);
      index.get(token).push(i);
    }
  });

  const parent = withTokens.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  // Index CVEs too, so two reports on one flaw are compared even when their
  // headlines share almost no vocabulary.
  const cveIndex = new Map();
  withTokens.forEach((entry, i) => {
    for (const cve of entry.cves) {
      if (!cveIndex.has(cve)) cveIndex.set(cve, []);
      cveIndex.get(cve).push(i);
    }
  });

  withTokens.forEach((entry, i) => {
    const neighbours = new Map();
    for (const token of entry.tokens) {
      for (const j of index.get(token) || []) {
        if (j === i) continue;
        neighbours.set(j, (neighbours.get(j) || 0) + 1);
      }
    }
    for (const cve of entry.cves) {
      for (const j of cveIndex.get(cve) || []) {
        if (j === i) continue;
        if (!neighbours.has(j)) neighbours.set(j, 0);
      }
    }

    for (const [j, sharedTokens] of neighbours) {
      if (j <= i) continue;
      const other = withTokens[j];
      const similarity = jaccard(entry.tokens, other.tokens);

      if (sharedTokens >= 2 && similarity >= 0.58) {
        union(i, j);
        continue;
      }
      // A shared CVE is strong evidence, but only between focused reports:
      // round-ups listing many CVEs would otherwise swallow unrelated stories.
      const focused = entry.cves.size > 0 && entry.cves.size <= 3 && other.cves.size > 0 && other.cves.size <= 3;
      if (focused && sharesMember(entry.cves, other.cves) && sharedTokens >= 2 && similarity >= 0.12) {
        union(i, j);
        continue;
      }

      // Not every story carries a CVE. Two headlines that share several rare
      // names - "ShinyHunters", "PeopleSoft" - are almost certainly the same
      // event covered from different angles, even when the wording diverges.
      // Requiring two distinctive tokens keeps separate incidents by the same
      // actor apart, since those share only the actor's name.
      if (similarity >= 0.28 && sharedDistinctive(entry.tokens, other.tokens) >= 2) {
        union(i, j);
      }
    }
  });

  const clusters = new Map();
  withTokens.forEach((entry, i) => {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(entry.item);
  });

  const out = [];
  for (const members of clusters.values()) {
    members.sort((a, b) => {
      const diff = representativeScore(b) - representativeScore(a);
      if (Math.abs(diff) > 0.001) return diff;
      return Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0);
    });
    const [primary, ...rest] = members;

    // Clustering can run more than once per refresh, so fold in corroborating
    // links discovered by an earlier pass rather than discarding them.
    const corroborating = [];
    const seenUrls = new Set([primary.url]);
    for (const candidate of [...rest, ...members.flatMap((m) => m.alsoReportedBy || [])]) {
      const url = candidate.url;
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);
      corroborating.push({ sourceName: candidate.sourceName, url, title: candidate.title });
    }

    out.push({ ...primary, alsoReportedBy: corroborating.slice(0, 6) });
  }
  return out;
}
