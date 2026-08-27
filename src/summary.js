import { config } from './config.js';
import { htmlToText, splitSentences } from './html.js';

const tokenise = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);

/** Fraction of `candidate` tokens that also appear in `reference`. */
function overlap(candidate, reference) {
  const a = tokenise(candidate);
  if (!a.length) return 0;
  const b = new Set(tokenise(reference));
  let hits = 0;
  for (const word of a) if (b.has(word)) hits += 1;
  return hits / a.length;
}

const ENDS_CLEANLY = /[.!?\u2026)"\u201d\u2019]\s*$/;

/**
 * Compose the 5-6 line card summary.
 *
 * Sentences are added whole until the target length is reached, so the text
 * always ends on a real sentence boundary rather than an ellipsis mid-clause.
 * `needsEnrichment` tells the pipeline whether it is worth fetching the
 * article page to lengthen a thin feed blurb.
 */
export function buildSummary(raw, { title = '', extra = '' } = {}) {
  const primary = htmlToText(raw);
  const secondary = htmlToText(extra);

  const collect = (source, sentences, seen) => {
    for (const sentence of splitSentences(source)) {
      const key = sentence.slice(0, 60).toLowerCase();
      if (seen.has(key)) continue;
      // A first sentence that just restates the headline adds nothing.
      if (!sentences.length && title && overlap(sentence, title) > 0.85) continue;
      if (sentence.length < 25 && sentences.length) continue;
      seen.add(key);
      sentences.push(sentence);
    }
    return sentences;
  };

  const seen = new Set();
  const sentences = collect(primary, [], seen);

  if (secondary) {
    // Feed blurbs frequently end on a clause the publisher cut short. Drop that
    // fragment before appending article text, or the two run together.
    if (sentences.length > 1 && !ENDS_CLEANLY.test(sentences[sentences.length - 1])) sentences.pop();
    collect(secondary, sentences, seen);
  }

  let text = '';
  for (const sentence of sentences) {
    const next = text ? `${text} ${sentence}` : sentence;
    if (text && next.length > config.maxSummaryChars) break;
    text = next;
    if (text.length >= config.targetSummaryChars) break;
  }

  if (!text) text = primary.slice(0, config.maxSummaryChars).trim();
  if (text.length > config.maxSummaryChars) {
    const clipped = text.slice(0, config.maxSummaryChars);
    const lastStop = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('! '), clipped.lastIndexOf('? '));
    text = lastStop > config.minSummaryChars ? clipped.slice(0, lastStop + 1) : clipped;
  }

  text = finish(text);

  return {
    text,
    // Publishers routinely cut their feed blurbs off mid-clause, so an
    // unfinished summary is as good a reason to fetch the article as a short one.
    needsEnrichment: text.length < config.minSummaryChars || text.endsWith('…'),
  };
}

/**
 * Leave the reader at a clean stop.
 *
 * Drops a trailing fragment when enough complete sentences remain, and
 * otherwise marks the cut with an ellipsis rather than ending mid-word.
 */
function finish(input) {
  let text = String(input ?? '')
    .replace(/\s*\[(?:\.\.\.|…)\]\s*$/, '')
    .replace(/\s*(?:\.\.\.|…)\s*$/, '')
    .trim();

  if (!text) return '';
  if (ENDS_CLEANLY.test(text)) return text;

  const lastStop = Math.max(text.lastIndexOf('. '), text.lastIndexOf('! '), text.lastIndexOf('? '));
  if (lastStop >= config.minSummaryChars) return text.slice(0, lastStop + 1).trim();

  return `${text.replace(/[\s,;:\-–—]+$/, '')}…`;
}

export { tokenise, overlap };
