/**
 * Minimal, tolerant XML reading helpers aimed squarely at RSS 2.0 and Atom.
 * Real-world feeds are frequently not well-formed, so this favours resilience
 * over strictness: it locates elements by name (namespace prefix optional),
 * unwraps CDATA and decodes entities, including the double-encoded HTML that
 * several government feeds emit.
 */

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–',
  mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“',
  rdquo: '”', hellip: '…', middot: '·', bull: '•',
  trade: '™', reg: '®', copy: '©', deg: '°',
  laquo: '«', raquo: '»', eacute: 'é', egrave: 'è',
  uuml: 'ü', ouml: 'ö', auml: 'ä', szlig: 'ß',
  aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú',
  ntilde: 'ñ', ccedil: 'ç', euro: '€', pound: '£',
  shy: '', zwj: '', zwnj: '', thinsp: ' ', ensp: ' ', emsp: ' ',
};

function decodeOnce(input) {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X'
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try { return String.fromCodePoint(code); } catch { return match; }
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named === undefined ? match : named;
  });
}

/** Decode entities, repeating while the text is still visibly encoded. */
export function decodeEntities(input) {
  let out = String(input ?? '');
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decodeOnce(out);
    if (next === out) break;
    out = next;
    if (!/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/.test(out)) break;
  }
  return out;
}

export function stripCData(input) {
  return String(input ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

const escapeName = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build a matcher for `name`, tolerating any namespace prefix when the caller
 * did not specify one (so `content` also matches `content:encoded`... no:
 * prefixes only, e.g. `title` matches `atom:title` but not `content:encoded`).
 */
function tagPattern(name, flags) {
  const n = escapeName(name);
  return new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${n}(\\s[^>]*?)?(/)?>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${n}\\s*>`, flags);
}

function selfClosingPattern(name, flags) {
  const n = escapeName(name);
  return new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${n}(\\s[^>]*?)?/>`, flags);
}

/** Every occurrence of an element, as { attrs, inner }. */
export function findAll(xml, name) {
  const source = String(xml ?? '');
  const out = [];
  const paired = tagPattern(name, 'gi');
  let match;
  while ((match = paired.exec(source)) !== null) {
    out.push({ attrs: match[1] || '', inner: match[3] || '' });
  }
  const solo = selfClosingPattern(name, 'gi');
  while ((match = solo.exec(source)) !== null) {
    out.push({ attrs: match[1] || '', inner: '' });
  }
  return out;
}

export function findFirst(xml, name) {
  const paired = tagPattern(name, 'i').exec(String(xml ?? ''));
  if (paired) return { attrs: paired[1] || '', inner: paired[3] || '' };
  const solo = selfClosingPattern(name, 'i').exec(String(xml ?? ''));
  if (solo) return { attrs: solo[1] || '', inner: '' };
  return null;
}

/** Text content of the first matching element, decoded and trimmed. */
export function tagText(xml, ...names) {
  for (const name of names) {
    const node = findFirst(xml, name);
    if (node && node.inner) {
      const value = decodeEntities(stripCData(node.inner)).trim();
      if (value) return value;
    }
  }
  return '';
}

export function attr(attrs, name) {
  const pattern = new RegExp(`${escapeName(name)}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
  const match = pattern.exec(String(attrs ?? ''));
  if (!match) return '';
  return decodeEntities(match[2] ?? match[3] ?? match[4] ?? '').trim();
}

/** Split a document into its RSS <item> / Atom <entry> blocks. */
export function extractEntries(xml) {
  const items = findAll(xml, 'item').map((n) => n.inner);
  if (items.length) return items;
  return findAll(xml, 'entry').map((n) => n.inner);
}
