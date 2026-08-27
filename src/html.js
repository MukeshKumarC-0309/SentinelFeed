import { decodeEntities, stripCData } from './xml.js';

const DROP_BLOCKS = /<(script|style|noscript|svg|iframe|form|figure|figcaption|nav|aside|footer|header|template)\b[\s\S]*?<\/\1\s*>/gi;
const BLOCK_END = /<\/(p|div|li|ul|ol|h[1-6]|section|article|blockquote|tr|table|pre)\s*>/gi;
const LINE_BREAK = /<br\s*\/?>/gi;

/** Placeholders used while protecting periods that must not end a sentence. */
const DOT_GUARD = '';
const DECIMAL_GUARD = '';

/** Boilerplate that feed HTML routinely tacks on to the end of a summary. */
const BOILERPLATE = [
  /^the post .*appeared first on .*$/i,
  /^read more.*$/i,
  /^continue reading.*$/i,
  /^share (this|on).*$/i,
  /^tags?:.*$/i,
  /^related( reading| posts| articles)?:.*$/i,
  /^(image|photo|credit|source):.*$/i,
  /^\s*\[?\.\.\.\]?\s*$/,
  /^subscribe.*newsletter.*$/i,
  /^sign up (for|to) .*$/i,
  /^follow us on.*$/i,
  /^this article (originally )?appeared.*$/i,
  /^(copyright|all rights reserved).*$/i,
  /^advertisement$/i,
];

/** Convert an HTML fragment into readable plain text. */
export function htmlToText(input) {
  let text = stripCData(String(input ?? ''));
  // Feed payloads are often escaped HTML; decode before we can strip tags.
  text = decodeEntities(text);
  text = text.replace(DROP_BLOCKS, ' ');
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  text = text.replace(LINE_BREAK, '\n');
  text = text.replace(BLOCK_END, '\n');
  text = text.replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text);
  text = text
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !BOILERPLATE.some((pattern) => pattern.test(line)))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Split prose into sentences without breaking on common abbreviations. */
export function splitSentences(text) {
  const guarded = String(text ?? '')
    .replace(
      /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Inc|Ltd|Corp|Co|vs|etc|e\.g|i\.e|approx|Gen|Sen|Rep|Gov|Lt|Col|Capt|U\.S|U\.K|E\.U|No|Fig|Vol|Ref|al)\.\s/g,
      (match) => match.replace('.', DOT_GUARD),
    )
    .replace(/\b([A-Z])\.\s(?=[A-Z]\.)/g, `$1${DOT_GUARD} `)
    .replace(/(\d)\.(\d)/g, `$1${DECIMAL_GUARD}$2`);

  return guarded
    .split(/(?<=[.!?])["')\]]?\s+(?=[A-Z0-9"'([])/)
    .map((sentence) =>
      sentence
        .split(DOT_GUARD)
        .join('.')
        .split(DECIMAL_GUARD)
        .join('.')
        .trim(),
    )
    .filter(Boolean);
}

/** Read a <meta> value by name or property, in either attribute order. */
export function metaContent(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content\\s*=\\s*["'][^"']*["'][^>]*(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const tag = pattern.exec(html)?.[0];
    if (!tag) continue;
    const content = /content\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    const value = content?.[2] ?? content?.[3];
    if (value) return decodeEntities(value).trim();
  }
  return '';
}
