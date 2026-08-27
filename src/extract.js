import { getText } from './http.js';
import { htmlToText, metaContent } from './html.js';
import { config } from './config.js';

/** Paragraph text from the most article-like container on the page. */
function bodyParagraphs(html) {
  const containers = [];
  const patterns = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/gi,
    /<main\b[^>]*>([\s\S]*?)<\/main>/gi,
    /<div[^>]+(?:class|id)\s*=\s*["'][^"']*(?:article-?(?:body|content|text)|post-?(?:body|content)|entry-content|story-?(?:body|content)|content-?body|field--name-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) containers.push(match[1]);
    if (containers.length) break;
  }
  const scope = containers.sort((a, b) => b.length - a.length)[0] || html;

  const paragraphs = [];
  const pTag = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = pTag.exec(scope)) !== null) {
    const text = htmlToText(match[1]);
    // Skip captions, bylines, cookie notices and other short fragments.
    if (text.length >= 60 && /[a-z]/.test(text)) paragraphs.push(text);
    if (paragraphs.join(' ').length > 2200) break;
  }
  return paragraphs;
}

/**
 * Fetch an article and return prose suitable for extending a thin feed
 * summary. Returns '' on any failure - enrichment is always best-effort.
 */
export async function fetchArticleText(url) {
  const res = await getText(url, {
    accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
  });
  if (!res.ok || !res.text) return '';
  const html = res.text;
  const lead =
    metaContent(html, 'og:description') ||
    metaContent(html, 'description') ||
    metaContent(html, 'twitter:description');
  const paragraphs = bodyParagraphs(html);

  const parts = [];
  const seen = new Set();
  for (const candidate of [lead, ...paragraphs]) {
    const text = String(candidate || '').trim();
    if (!text) continue;
    const key = text.slice(0, 80).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(text);
    if (parts.join(' ').length >= config.maxSummaryChars + 400) break;
  }
  return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
}
