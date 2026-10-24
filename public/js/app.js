/* SENTINEL FEED - client. No framework, no build step. */

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const state = {
  briefing: null,
  archive: null,
  sources: null,
  status: null,
  loadedViews: new Set(),
  archiveFilter: '',
  openSections: new Set(),
  topics: null,
  trends: null,
  skills: null,
  weekly: null,
  search: { query: null, offset: 0, total: 0, results: [] },
  entity: null,
  explain: false,
  easiestFirst: false,
  glossary: null,
  glossaryIndex: null,
  profile: null,
  unreadFilter: 'all',
  openEditions: new Set(),
  editionCache: new Map(),
};

/* ---- helpers --------------------------------------------------------- */

/** Escape text for interpolation into HTML. All feed content passes through here. */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only allow http(s) links through to the DOM. */
function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return /^https?:$/.test(url.protocol) ? url.toString() : '#';
  } catch {
    return '#';
  }
}

function timeAgo(iso) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function formatStamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function countdown(iso) {
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return '—';
  const remaining = target - Date.now();
  if (remaining <= 0) return 'due now';
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m`
    : `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

async function getJson(path) {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.message || `Request failed (${res.status})`), { body, status: res.status });
  return body;
}

const pctLabel = (value) => `${Number(value).toFixed(1)}%`;

/* ---- rendering: stories ---------------------------------------------- */

function evidenceList(headlines, label = 'Evidence') {
  if (!headlines?.length) return '';
  return `<div class="evidence">${label ? `<span class="evidence-label">${esc(label)}</span>` : ''}${headlines
    .map(
      (h) =>
        `<a href="${safeUrl(h.url)}" target="_blank" rel="noopener noreferrer">${esc(h.title)}<span class="n"> — ${esc(
          h.source,
        )}</span></a>`,
    )
    .join('')}</div>`;
}

function storyCard(story, { lead = false, index = 0 } = {}) {
  // The lead card can carry more chrome; the grid cards stay quiet, or six of
  // them side by side become a wall of badges.
  const signals = (story.signals || [])
    .slice(0, lead ? 3 : 1)
    .map((s) => `<span class="chip chip-signal">${esc(s)}</span>`)
    .join('');

  const tags = (story.themes || [])
    .slice(0, lead ? 3 : 1)
    .map((t) => `<span class="tag">${esc(t.label)}</span>`)
    .join('');

  // Two corroborating sources are enough to show a story is widely covered;
  // the rest are counted rather than listed, with their names on hover.
  const others = story.alsoReportedBy || [];
  const shown = lead ? others : others.slice(0, 2);
  const hidden = others.slice(shown.length);
  const also = others.length
    ? `<div class="also"><span class="also-label">Also reported by</span>${shown
        .map(
          (a) =>
            `<a href="${safeUrl(a.url)}" target="_blank" rel="noopener noreferrer" title="${esc(a.title)}">${esc(
              a.sourceName,
            )}</a>`,
        )
        .join('')}${
        hidden.length
          ? `<span class="also-more" title="${esc(hidden.map((a) => a.sourceName).join(', '))}">+${hidden.length} more</span>`
          : ''
      }</div>`
    : '';

  const idx = index ? String(index).padStart(2, '0') : '';

  return `
    <article class="card${lead ? ' is-lead' : ''}" data-story="${esc(story.id)}"
             data-read="${isRead(story.id)}" data-new="${showsNew(story.id)}">
      ${idx ? `<span class="card-index">${idx}</span>` : ''}
      <div class="card-top">
        <span class="chip">${esc(story.sourceName)}</span>
        ${lead ? `<span class="chip chip-kind" data-kind="${esc(story.sourceKind)}">${esc(story.sourceKind)}</span>` : ''}
        ${signals}
        <span class="read-mark">Read</span>
        <span class="card-time">${esc(timeAgo(story.publishedAt))}</span>
      </div>
      <h3 class="card-title">
        <a href="${safeUrl(story.url)}" target="_blank" rel="noopener noreferrer">${esc(story.title)}</a>
      </h3>
      <p class="card-summary">${annotate(esc(story.summary))}</p>
      ${whyBlock(story)}
      <div class="card-foot">
        ${tags}
        <a class="read-link" href="${safeUrl(story.url)}" target="_blank" rel="noopener noreferrer">Read at ${esc(
          story.sourceName,
        )} →</a>
        ${also}
      </div>
    </article>`;
}

/* ---- reader profile ---------------------------------------------------- */

const isNew = (id) => Boolean(state.profile?.newIds?.includes(id));

/**
 * Whether "new" means anything right now. On a first visit, or after a long
 * absence, everything is new - marking all of it would only add noise - so
 * stories are flagged only when some are new and others are not.
 */
function newIsInformative() {
  const count = state.profile?.newCount || 0;
  return count > 0 && count < (state.briefing?.stories?.length || 0);
}
const showsNew = (id) => newIsInformative() && isNew(id);
const watching = (bucket, key) => Boolean(state.profile?.watch?.[bucket]?.includes(key));
const isRead = (id) => Boolean(state.profile?.readIds?.includes(id));

/** Register the visit, which also settles what counts as new this cycle. */
async function loadProfile({ register = false } = {}) {
  try {
    const res = await fetch('/api/profile', {
      method: register ? 'POST' : 'GET',
      headers: { accept: 'application/json' },
    });
    if (res.ok) state.profile = await res.json();
  } catch {
    // The site is perfectly usable without reading state.
    state.profile = state.profile || null;
  }
  return state.profile;
}

async function postProfile(path, body) {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Mark one story read, optimistically so the dimming is instant. */
async function markStoryRead(id) {
  if (!id || isRead(id)) return;
  if (state.profile) state.profile.readIds = [...(state.profile.readIds || []), id];
  $$(`[data-story="${CSS.escape(id)}"]`).forEach((el) => el.setAttribute('data-read', 'true'));
  const updated = await postProfile('/api/profile/read', { ids: [id] });
  if (updated && state.profile) Object.assign(state.profile, updated);
  updateReadingControls();
}

function updateReadingControls() {
  const profile = state.profile;
  const seg = $('#seg-unread');
  const markAll = $('#mark-all-read');
  $('#easiest-first').hidden = !state.explain;
  if (!profile) {
    seg.hidden = true;
    markAll.hidden = true;
    return;
  }
  // The unread filter only earns its place once something is actually new.
  seg.hidden = !newIsInformative();
  markAll.hidden = profile.readCount >= (state.briefing?.stories?.length || 0);
  $('#easiest-first').hidden = !state.explain;
}

/* ---- plain-English layer ----------------------------------------------- */

const escapeRe = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Load the glossary once and pre-build the longest-first matcher. */
async function loadGlossary() {
  if (state.glossaryIndex) return state.glossaryIndex;
  try {
    const { terms } = await getJson('/api/glossary');
    state.glossary = terms;
    const forms = [];
    for (const item of terms) {
      for (const form of [item.term, ...(item.aliases || [])]) {
        forms.push({ form, term: item.term, short: item.short });
      }
    }
    // Longest first, so "remote code execution" wins over "code execution".
    forms.sort((a, b) => b.form.length - a.form.length);
    state.glossaryIndex = forms;
  } catch {
    state.glossaryIndex = [];
  }
  return state.glossaryIndex;
}

/** Distinct defined terms in a piece of text. */
function termsIn(text) {
  const found = new Map();
  const haystack = String(text || '');
  for (const entry of state.glossaryIndex || []) {
    if (found.has(entry.term)) continue;
    if (new RegExp(`\\b${escapeRe(entry.form)}\\b`, 'i').test(haystack)) found.set(entry.term, entry);
  }
  return [...found.values()];
}

/**
 * How much prior knowledge a story assumes: defined terms per hundred words.
 * Used to order the feed gently rather than to hide anything.
 */
function demandScore(story) {
  const text = `${story.title} ${story.summary}`;
  const words = text.split(/\s+/).length || 1;
  return (termsIn(text).length / words) * 100;
}

/**
 * Wrap the first occurrence of each known term in an explain button.
 *
 * `text` must already be escaped: this returns HTML. Headlines are left alone
 * on purpose, because a button inside the headline's link would nest two
 * interactive elements.
 */
function annotate(escapedText) {
  if (!state.explain || !state.glossaryIndex?.length) return escapedText;

  let html = escapedText;
  const used = new Set();

  for (const entry of state.glossaryIndex) {
    if (used.has(entry.term)) continue;
    // Skip anything already inside a tag we inserted.
    const pattern = new RegExp(`(?![^<]*>)\\b(${escapeRe(entry.form)})\\b`, 'i');
    if (!pattern.test(html)) continue;
    html = html.replace(
      pattern,
      `<button class="term" data-term="${esc(entry.term)}" aria-label="What does $1 mean?">$1</button>`,
    );
    used.add(entry.term);
  }
  return html;
}

/** The theme implication behind a story, used for "why this matters". */
function whyItMatters(story) {
  const themeId = (story.themes || [])[0]?.id;
  if (!themeId) return null;
  const theme = (state.briefing?.insights?.themes || []).find((t) => t.id === themeId);
  return theme?.implication || null;
}

function whyBlock(story) {
  if (!state.explain) return '';
  const why = whyItMatters(story);
  if (!why) return '';
  return `<div class="why"><span class="why-label">Why this matters</span><p>${annotate(esc(why))}</p></div>`;
}

/* ---- term popover ------------------------------------------------------- */

function closeTermPop() {
  const pop = $('#term-pop');
  pop.hidden = true;
  $$('.term[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

function openTermPop(button) {
  const entry = (state.glossary || []).find((t) => t.term === button.dataset.term);
  if (!entry) return;

  const pop = $('#term-pop');
  $('#term-pop-name').textContent = entry.term;
  $('#term-pop-text').textContent = entry.short;
  pop.hidden = false;

  // Position under the term, nudged to stay on screen.
  const rect = button.getBoundingClientRect();
  const width = Math.min(340, window.innerWidth - 24);
  pop.style.width = `${width}px`;
  let left = rect.left + window.scrollX;
  left = Math.min(left, window.scrollX + window.innerWidth - width - 12);
  left = Math.max(left, window.scrollX + 12);
  pop.style.left = `${left}px`;
  pop.style.top = `${rect.bottom + window.scrollY + 8}px`;

  button.setAttribute('aria-expanded', 'true');
}

/* ---- the cover -------------------------------------------------------- */

/** First sentences of a summary, trimmed to a two-line dek. */
function toDek(summary, max = 200) {
  const text = String(summary || '').trim();
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const stop = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('! '), clipped.lastIndexOf('? '));
  return stop > 80 ? clipped.slice(0, stop + 1) : `${clipped.replace(/\s+\S*$/, '')}…`;
}

function renderSitrep() {
  const data = state.briefing;
  if (!data) return;

  const stories = data.stories || [];
  const lead = stories[0];
  const meta = data.meta || {};
  const alerts = tickerStories().length;

  const date = new Date(data.edition.createdAt);
  $('#sitrep-date').textContent = Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  $('#sitrep-edition').textContent = data.edition.id;

  if (lead) {
    const link = $('#sitrep-lead');
    link.href = safeUrl(lead.url);
    $('#sitrep-byline').href = safeUrl(lead.url);
    $('#sitrep-headline').textContent = lead.title;
    $('#sitrep-dek').innerHTML = annotate(esc(toDek(lead.summary)));
    $('#sitrep-byline').textContent = `${lead.sourceName} · ${timeAgo(lead.publishedAt)}`;

    const flag = $('#sitrep-flag');
    const signal = (lead.signals || [])[0];
    flag.hidden = !signal;
    if (signal) flag.textContent = signal;
  }

  // One quiet line of figures, each answering a question a reader has on
  // arrival: what is new to me, how urgent, how much, how complete.
  const profile = state.profile;
  const partiallyNew = newIsInformative();
  const stats = [];

  // What is new to *this reader* leads, because roughly half of each edition
  // repeats the last one. On a first visit everything is new, which says
  // nothing, so the figure stays away.
  if (partiallyNew) stats.push({ label: 'new for you', value: profile.newCount, tone: 'new' });
  if (alerts > 0) stats.push({ label: alerts === 1 ? 'active alert' : 'active alerts', value: alerts, tone: 'alert' });
  stats.push(
    { label: 'clippings', value: stories.length },
    { label: 'sources live', value: `${meta.sourcesOk ?? '—'}/${meta.sourcesTotal ?? '—'}` },
  );

  $('#sitrep-stats').innerHTML = stats
    .map(
      (stat) => `
      <div class="sitrep-stat"${stat.tone ? ` data-tone="${esc(stat.tone)}"` : ''}>
        <dt>${esc(stat.label)}</dt>
        <dd>${esc(stat.value)}</dd>
      </div>`,
    )
    .join('');

  renderWatchLine();
}

/** A single quiet line, shown only when something the reader follows has moved. */
function renderWatchLine() {
  const host = $('#sitrep-watch');
  const active = (state.profile?.watchActivity || []).filter((w) => w.new > 0);

  if (!active.length) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  host.innerHTML =
    `<span class="watch-label">Following</span>` +
    active
      .slice(0, 4)
      .map(
        (w) =>
          `<a class="watch-hit" href="${safeUrl(w.stories[0]?.url)}" target="_blank" rel="noopener noreferrer">${esc(
            w.label,
          )}<span class="watch-n">${w.new} new</span></a>`,
      )
      .join('');
}

/* ---- live alert ticker ------------------------------------------------ */

const TICKER_SIGNALS = new Set(['Active exploitation', 'Zero-day', 'CISA KEV', 'Emergency patch']);

/** Stories urgent enough to sit in the ticker, most severe first. */
function tickerStories({ excludeLead = false } = {}) {
  const all = state.briefing?.stories || [];
  const leadUrl = all[0]?.url;
  const stories = all.filter(
    (s) =>
      (s.signals || []).some((signal) => TICKER_SIGNALS.has(signal)) &&
      !(excludeLead && s.url === leadUrl),
  );
  return stories.slice(0, 8);
}

function renderTicker() {
  const bar = $('#ticker');
  const track = $('#ticker-track');
  const stories = tickerStories({ excludeLead: true });

  if (!stories.length) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  $('#ticker-count').textContent = `${stories.length} active`;

  track.innerHTML = stories
    .map(
      (story, i) => `
      <a class="ticker-item${i === 0 ? ' is-live' : ''}" href="${safeUrl(story.url)}"
         target="_blank" rel="noopener noreferrer" data-i="${i}">
        <span class="ticker-signal">${esc((story.signals || [])[0] || 'Alert')}</span>
        <span class="ticker-text">${esc(story.title)}</span>
        <span class="ticker-src">${esc(story.sourceName)}</span>
      </a>`,
    )
    .join('');

  startTicker(stories.length);
}

let tickerTimer = null;
let tickerIndex = 0;

function startTicker(count) {
  clearInterval(tickerTimer);
  tickerIndex = 0;
  if (count < 2) return;
  // Readers who prefer reduced motion get the first alert, held still.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  tickerTimer = setInterval(() => {
    const items = $$('.ticker-item');
    if (!items.length) return clearInterval(tickerTimer);
    items[tickerIndex % items.length]?.classList.remove('is-live');
    tickerIndex = (tickerIndex + 1) % items.length;
    items[tickerIndex]?.classList.add('is-live');
  }, 6000);
}

/** How many full cards sit above the topic sections. */
const TOP_STORIES = 6;

/** One line per story: headline, source, age. Used inside topic sections. */
function compactRow(story) {
  const signal = (story.signals || [])[0];
  return `
    <li class="row" data-story="${esc(story.id)}" data-read="${isRead(story.id)}" data-new="${showsNew(story.id)}">
      <a class="row-title" href="${safeUrl(story.url)}" target="_blank" rel="noopener noreferrer">${esc(story.title)}</a>
      <span class="row-meta">
        ${signal ? `<span class="row-signal">${esc(signal)}</span>` : ''}
        <span class="row-src">${esc(story.sourceName)}</span>
        <span class="read-mark">Read</span>
        <span class="row-time">${esc(timeAgo(story.publishedAt))}</span>
      </span>
    </li>`;
}

/** Group the remaining stories under their strongest theme. */
function groupByTopic(stories) {
  const groups = new Map();
  for (const story of stories) {
    const theme = (story.themes || [])[0];
    const id = theme?.id || 'other';
    const label = theme?.label || 'Everything else';
    if (!groups.has(id)) groups.set(id, { id, label, stories: [] });
    groups.get(id).stories.push(story);
  }
  // Largest topic first, but the untagged catch-all always sinks to the
  // bottom: it is the least coherent group and a poor thing to open on.
  return [...groups.values()].sort((a, b) => {
    if (a.id === 'other') return 1;
    if (b.id === 'other') return -1;
    return b.stories.length - a.stories.length;
  });
}

function renderTopicSections(stories) {
  const host = $('#briefing-sections');
  const groups = groupByTopic(stories);

  // Every section starts closed: the topic names are the overview, and the
  // band heading says to select one. Opening one is the reader's choice.
  host.innerHTML = groups
    .map((group) => {
      const open = state.openSections.has(group.id);
      return `
        <div class="section" data-open="${open}">
          <div class="section-bar">
            <button class="section-head" data-section="${esc(group.id)}" aria-expanded="${open}">
              <span class="section-caret">▸</span>
              <span class="section-name">${esc(group.label)}</span>
              <span class="section-count">${group.stories.length}</span>
            </button>
            ${
              group.id === 'other'
                ? ''
                : `<button class="follow-btn" data-watch-bucket="topics" data-watch-key="${esc(group.id)}"
                     aria-pressed="${watching('topics', group.id)}"
                     title="Follow this topic">${watching('topics', group.id) ? '★' : '☆'}</button>`
            }
          </div>
          <ul class="section-body">${group.stories.map(compactRow).join('')}</ul>
        </div>`;
    })
    .join('');
}

function renderBriefing() {
  const data = state.briefing;
  if (!data) return;

  const leadHost = $('#briefing-lead');
  const grid = $('#briefing-grid');
  const bandTop = $('#band-top');
  const bandTopics = $('#band-topics');
  const empty = $('#briefing-empty');

  const stories = data.stories || [];
  renderTicker();
  renderSitrep();
  if (!stories.length) {
    leadHost.innerHTML = '';
    grid.innerHTML = '';
    bandTop.hidden = true;
    bandTopics.hidden = true;
    empty.hidden = false;
    empty.textContent = 'No stories in this edition.';
    return;
  }
  empty.hidden = true;

  const meta = data.meta || {};
  // The cover already gives the clipping and source counts; this adds only
  // what it does not say - how much was read to choose them.
  $('#briefing-count').textContent = meta.corpusSize ? `Chosen from ${meta.corpusSize} unique stories` : '';

  // The cover already carries story one, so the feed continues from two
  // rather than printing the same headline twice in a row.
  let rest = stories.slice(1);
  if (state.unreadFilter === 'new') rest = rest.filter((story) => isNew(story.id));

  // Within the cards band, unseen stories come first: the six slots above the
  // fold should not be spent on headlines the reader already went through.
  let ranked = state.profile
    ? [...rest].sort((a, b) => Number(isNew(b.id)) - Number(isNew(a.id)))
    : rest;

  // Ordering, never hiding: the specialist stories stay, they just wait.
  if (state.easiestFirst && state.glossaryIndex?.length) {
    ranked = [...ranked].sort((a, b) => demandScore(a) - demandScore(b));
  }
  const top = ranked.slice(0, TOP_STORIES);
  const remainder = ranked.slice(TOP_STORIES);

  leadHost.innerHTML = '';
  grid.innerHTML = top.map((story, i) => storyCard(story, { index: i + 2 })).join('');
  bandTop.hidden = top.length === 0;

  bandTopics.hidden = remainder.length === 0;
  if (remainder.length) renderTopicSections(remainder);

  if (state.unreadFilter === 'new' && !rest.length) {
    empty.hidden = false;
    empty.textContent = 'Nothing new since your last visit. Switch to All to read the full edition.';
  }

  updateReadingControls();
}

/* ---- rendering: insights --------------------------------------------- */

const KIND_NAMES = {
  journalism: 'journalism',
  authority: 'advisories',
  research: 'research',
  practitioner: 'practitioners',
};

/** Four short readings of the whole edition: breadth, urgency, voices, names. */
function overviewFacts(overview) {
  const facts = [
    {
      label: 'Breadth',
      value: `${overview.breadth.matched} of ${overview.breadth.tracked} themes`,
      note: `${overview.breadth.label} · top three ${overview.breadth.top3Share}%`,
    },
    {
      label: 'Urgent',
      value: `${overview.urgentStories} ${overview.urgentStories === 1 ? 'story' : 'stories'}`,
      note: 'exploited, zero-day, KEV or emergency patch',
      tone: overview.urgentStories ? 'alert' : '',
    },
    {
      label: 'Who is reporting',
      value: overview.sourceMix
        .slice(0, 3)
        .map((m) => `${m.share}% ${KIND_NAMES[m.kind] || m.kind}`)
        .join(' · '),
      note: `${overview.sources} sources`,
    },
    {
      label: 'Named',
      value: `${overview.entities.cves} CVEs · ${overview.entities.actors} groups`,
      note: overview.entities.topCve ? `most cited ${overview.entities.topCve}` : 'across the edition',
    },
  ];
  return `<dl class="facts">${facts
    .map(
      (fact) => `
      <div class="fact"${fact.tone ? ` data-tone="${fact.tone}"` : ''}>
        <dt>${esc(fact.label)}</dt>
        <dd>${esc(fact.value)}</dd>
        <dd class="fact-note">${esc(fact.note)}</dd>
      </div>`,
    )
    .join('')}</dl>`;
}

/**
 * Show the first `visible` items, and fold the rest behind a "show more"
 * the reader opens when they want it. `wrap` puts each group in the same
 * container so a grid keeps its columns either side of the fold.
 */
function showSome(items, visible, render, moreLabel, wrap = (html) => html) {
  const shown = items.slice(0, visible);
  const rest = items.slice(visible);
  return `${wrap(shown.map(render).join(''))}${
    rest.length
      ? `<details class="more"><summary>${esc(moreLabel(rest.length))}</summary>${wrap(rest.map(render).join(''))}</details>`
      : ''
  }`;
}

/** A story's sources, tucked behind a small toggle until asked for. */
function sourcesToggle(headlines, label = 'Sources') {
  if (!headlines?.length) return '';
  return `<details class="reveal"><summary>${esc(label)} (${headlines.length})</summary>${evidenceList(headlines, '')}</details>`;
}

function renderInsights() {
  const data = state.briefing;
  const host = $('#insights-body');
  if (!data) return;

  const insights = data.insights;
  if (!insights || !insights.themes?.length) {
    host.innerHTML = '<p class="empty">No themed signal in this edition yet.</p>';
    return;
  }

  // Insights is the reading of this one edition, in words; the numbers over
  // time live in Trends. Each section leads with its essentials and folds
  // the rest away, so the page reads in a minute and goes deep on request.
  const { outlook, skills, mindsets, method } = insights;
  // Editions built before the overview existed simply go without it.
  const overview = insights.overview;

  // The summary opens on two sentences; the rest is one click away.
  const sentences = overview?.sentences || outlook.lede.split(/(?<=\.)\s+(?=[A-Z0-9])/);
  const opening = sentences.slice(0, 2).join(' ');
  const remainder = sentences.slice(2).join(' ');

  const sections = [
    { id: 'insights-landscape', label: 'The whole edition', show: overview?.landscape?.length },
    { id: 'insights-reading', label: 'What it tells us', show: outlook.reading?.length },
    { id: 'insights-horizon', label: 'What may come next', show: outlook.horizon?.length },
    { id: 'insights-skills', label: 'Skills to build', show: skills?.length },
    { id: 'insights-mindsets', label: 'How to think about it', show: mindsets?.length },
  ].filter((section) => section.show);

  const grid = (html) => `<div class="grid-2">${html}</div>`;
  const landGrid = (html) => `<div class="landscape">${html}</div>`;

  host.innerHTML = `
    <section class="brief">
      <p class="brief-label">In brief</p>
      <p class="lede">${annotate(esc(opening))}</p>
      ${
        remainder
          ? `<details class="more more-text"><summary>Read the full summary</summary><p class="prose">${annotate(
              esc(remainder),
            )}</p></details>`
          : ''
      }
      ${overview ? overviewFacts(overview) : ''}
      <nav class="jump" aria-label="On this page">
        ${sections
          .map((section) => `<button type="button" class="jump-link" data-jump="${section.id}">${esc(section.label)}</button>`)
          .join('')}
        <button type="button" class="jump-link jump-out" data-goto="trends">Trends over time &rarr;</button>
      </nav>
    </section>

    ${
      overview?.landscape?.length
        ? `<section class="panel" id="insights-landscape">
            <div class="panel-head"><h3>The whole edition</h3><span class="hint">${overview.landscape.length} themes, largest first</span></div>
            ${showSome(
              overview.landscape,
              6,
              (theme) => {
                const example = theme.examples[0];
                return `
                <div class="land">
                  <div class="land-head">
                    <span class="land-name">${esc(theme.label)}</span>
                    <span class="land-count">${theme.count} ${theme.count === 1 ? 'story' : 'stories'}</span>
                  </div>
                  ${
                    example
                      ? `<a class="land-example" href="${safeUrl(example.url)}" target="_blank" rel="noopener noreferrer">${esc(
                          example.title,
                        )}<span class="land-src">${esc(example.source)}</span></a>`
                      : ''
                  }
                </div>`;
              },
              (n) => `Show all ${overview.landscape.length} themes (${n} more)`,
              landGrid,
            )}
          </section>`
        : ''
    }

    <section class="panel" id="insights-reading">
      <div class="panel-head"><h3>What this edition is telling us</h3><span class="hint">the leading themes</span></div>
      ${grid(
        outlook.reading
          .map(
            (item) => `
          <div class="mini">
            <div class="mini-label">${esc(item.label)}<span class="share">${pctLabel(item.share)}</span></div>
            <p>${annotate(esc(item.text))}</p>
            ${sourcesToggle(item.headlines)}
          </div>`,
          )
          .join(''),
      )}
    </section>

    <section class="panel" id="insights-horizon">
      <div class="panel-head"><h3>What may come next</h3><span class="hint">extrapolated from the leading themes</span></div>
      ${grid(
        outlook.horizon
          .map(
            (item) => `
          <div class="mini">
            <div class="mini-label">${esc(item.label)}</div>
            <p>${annotate(esc(item.text))}</p>
          </div>`,
          )
          .join(''),
      )}
      ${
        outlook.convergences?.length
          ? `<details class="more"><summary>Where themes converge (${outlook.convergences.length})</summary>
              ${outlook.convergences
                .map(
                  (c) => `
                <div class="mini" data-tone="converge">
                  <div class="mini-label">${c.themes.map(esc).join(' + ')}</div>
                  <p>${annotate(esc(c.text))}</p>
                  ${sourcesToggle(c.headlines)}
                </div>`,
                )
                .join('')}
            </details>`
          : ''
      }
    </section>

    <section class="panel" id="insights-skills">
      <div class="panel-head"><h3>Skills to build</h3><span class="hint">most needed first</span></div>
      ${showSome(
        skills.map((skill, index) => ({ skill, index })),
        3,
        ({ skill, index }) => `
        <div class="skill">
          <div class="skill-top">
            <span class="skill-rank">${String(index + 1).padStart(2, '0')}</span>
            <span class="skill-name">${esc(skill.label)}</span>
          </div>
          <p class="skill-why">${annotate(esc(skill.demandDriver))}</p>
          <details class="reveal"><summary>How to build it</summary>
            <div class="skill-practice">${annotate(esc(skill.practice))}</div>
            <div class="evidence">
              <span class="evidence-label">Driven by</span>
              <span>${skill.drivenBy.map(esc).join(' · ')}</span>
            </div>
            ${evidenceList(skill.headlines, 'Seen in')}
          </details>
        </div>`,
        (n) => `Show ${n} more ${n === 1 ? 'skill' : 'skills'}`,
      )}
    </section>

    <section class="panel" id="insights-mindsets">
      <div class="panel-head"><h3>How to think about it</h3><span class="hint">the thinking the industry is encouraging</span></div>
      ${showSome(
        mindsets,
        2,
        (mindset) => `
          <div class="mini" data-tone="mindset">
            <div class="mini-label">${esc(mindset.theme)}</div>
            <p>${annotate(esc(mindset.text))}</p>
            ${sourcesToggle(mindset.headlines)}
          </div>`,
        (n) => `Show ${n} more`,
        grid,
      )}
    </section>

    <details class="more method"><summary>How these insights are made</summary>
      <p class="method-note">${esc(method.note)} ${esc(method.themesMatched)} of ${esc(
        method.themesEvaluated,
      )} tracked themes matched this edition. For how each theme, skill and named vulnerability or
      actor moves across editions, see Trends.</p>
    </details>`;
}

/* ---- rendering: trends ------------------------------------------------ */

/**
 * Inline sparkline. Drawn as an SVG path rather than a chart library so it
 * stays a few hundred bytes and inherits the page's theme colours.
 */
function sparkline(series, direction) {
  const values = series.length ? series : [0];
  const width = 100;
  const height = 30;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const points = values.map((value, i) => [i * step, height - (value / max) * (height - 4) - 2]);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const [lastX, lastY] = points[points.length - 1];

  // No <defs>/gradient here on purpose: one sparkline per theme would mean
  // many elements sharing a gradient id, and duplicate ids in a document are
  // invalid - browsers resolve them all to whichever came first. The fill is
  // done in CSS instead, which also keeps it themed per direction.
  return `<svg class="spark" data-dir="${esc(direction)}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
    <path class="spark-area" d="${area}"/>
    <path class="spark-line" d="${line}"/>
    <circle class="spark-dot" cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.2"/>
  </svg>`;
}

function ledgerTable(rows, bucket, caption) {
  if (!rows.length) return '';
  return `
    <table class="ledger">
      <thead><tr>
        <th>${esc(caption)}</th><th>Editions</th><th>Mentions</th><th>First seen</th><th class="recent">Most recent story</th>
      </tr></thead>
      <tbody>
        ${rows
          .map(
            (row) => `
          <tr>
            <td class="key">
              <button data-entity="${esc(bucket)}" data-key="${esc(row.key)}">${esc(row.label)}</button>
              <button class="follow-btn" data-watch-bucket="${esc(bucket)}" data-watch-key="${esc(row.label)}"
                      aria-pressed="${watching(bucket, row.label)}"
                      title="Follow">${watching(bucket, row.label) ? '★' : '☆'}</button>
            </td>
            <td class="num">${row.editions}</td>
            <td class="num">${row.mentions}</td>
            <td class="num">${esc(formatStamp(row.first))}</td>
            <td class="recent">${
              row.stories[0]
                ? `<a href="${safeUrl(row.stories[0].url)}" target="_blank" rel="noopener noreferrer">${esc(
                    row.stories[0].title,
                  )}</a>`
                : '—'
            }</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

const SKILL_STATUS = {
  sustained: 'Demanded in almost every edition',
  rising: 'Growing across the window',
  steady: 'Holding its level',
  spike: 'Loud this cycle, rare across the window',
  fading: 'Receding',
};

function renderSkillTrends() {
  const data = state.skills;
  if (!data?.skills?.length) return '';

  const max = Math.max(...data.skills.map((s) => s.average), 1);

  return `
    <section class="panel">
      <div class="panel-head">
        <h3>Skills, across the archive</h3>
        <span class="hint">${data.editions} editions · durability before volume</span>
      </div>
      <p class="prose" style="margin-bottom:16px">A single edition re-shuffles every twelve hours.
      This reads the whole window, so a skill demanded in nearly every edition outranks one that is
      merely loud today.</p>
      ${data.skills
        .slice(0, 12)
        .map(
          (skill) => `
        <div class="skill-row">
          <div class="skill-row-name">${esc(skill.label)}
            <span class="skill-row-sub">${esc(SKILL_STATUS[skill.status] || skill.status)}</span>
          </div>
          <div class="bar"><div class="bar-fill" data-tone="skill" style="width:${Math.round(
            (skill.average / max) * 100,
          )}%"></div></div>
          <div class="skill-row-meta">
            <span class="skill-badge" data-status="${esc(skill.status)}">${esc(skill.status)}</span>
            <span class="skill-presence">${skill.presence}% · ${skill.change > 0 ? '+' : ''}${skill.change}</span>
          </div>
        </div>`,
        )
        .join('')}
    </section>`;
}

function renderTrends() {
  const host = $('#trends-body');
  const data = state.trends;
  if (!data) return;

  if (!data.themes?.length) {
    host.innerHTML = `<p class="empty">Trends need at least one published edition. Once a few editions
      accumulate, this view shows how each theme moves over time.</p>`;
    return;
  }

  const span = data.coverage.editions;
  const detail = state.entity
    ? `<div class="entity-detail">
         <h4>${esc(state.entity.label)}</h4>
         <p class="when">Seen in ${state.entity.editions.length} edition${
           state.entity.editions.length === 1 ? '' : 's'
         } · first ${esc(formatStamp(state.entity.first))} · last ${esc(formatStamp(state.entity.last))}</p>
         <ol>${state.entity.stories
           .map(
             (story) =>
               `<li><a href="${safeUrl(story.url)}" target="_blank" rel="noopener noreferrer">${esc(
                 story.title,
               )}</a> <span class="entity-source">${esc(story.source)} · ${esc(
                 formatStamp(story.publishedAt),
               )}</span></li>`,
           )
           .join('')}</ol>
       </div>`
    : '';

  host.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h3>Theme trajectories</h3>
        <span class="hint">${span} edition${span === 1 ? '' : 's'} · direction compares the recent half of the window against the earlier half</span>
      </div>
      ${data.themes
        .map(
          (theme) => `
        <div class="trend-row">
          <div class="trend-label">${esc(theme.label)}
            <span class="sub">present in ${theme.editionsPresent}/${theme.series.length} editions · peak ${pctLabel(
              theme.peak,
            )}</span>
          </div>
          ${sparkline(theme.series, theme.direction)}
          <div class="trend-meta">${pctLabel(theme.current)}
            <span class="dir" data-dir="${esc(theme.direction)}">${esc(theme.direction)} ${
              theme.change > 0 ? '+' : ''
            }${theme.change}</span>
          </div>
        </div>`,
        )
        .join('')}
    </section>

    ${renderSkillTrends()}

    <section class="panel">
      <div class="panel-head"><h3>Vulnerability ledger</h3><span class="hint">ranked by how many editions each CVE persisted across</span></div>
      ${ledgerTable(data.cves, 'cves', 'CVE') || '<p class="prose">No CVEs tracked yet.</p>'}
    </section>

    <section class="panel">
      <div class="panel-head"><h3>Actor &amp; malware ledger</h3><span class="hint">select a name to see its timeline</span></div>
      ${ledgerTable(data.actors, 'actors', 'Name') || '<p class="prose">No named actors tracked yet.</p>'}
      ${detail}
    </section>`;
}

async function showEntity(bucket, key) {
  try {
    state.entity = await getJson(`/api/entity/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`);
  } catch {
    state.entity = null;
  }
  renderTrends();
  $('.entity-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---- rendering: search ------------------------------------------------ */

function resultRow(item) {
  return `
    <div class="result">
      <div class="result-top">
        <span class="src">${esc(item.sourceName)}</span>
        <span>${esc(formatStamp(item.publishedAt))}</span>
        <span class="ed">${esc(item.editionId)}</span>
      </div>
      <h4 class="result-title"><a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${esc(
        item.title,
      )}</a></h4>
      <p class="result-summary">${esc(item.summary)}</p>
    </div>`;
}

function renderSearch() {
  const host = $('#search-results');
  const meta = $('#search-meta');
  const data = state.search;

  if (!data.query) {
    meta.textContent = '';
    host.innerHTML = `<p class="empty">Search every clipping the site has ever published — by headline,
      source, topic or CVE. Wrap a phrase in "quotes" to match it exactly.</p>`;
    return;
  }

  if (!data.results.length) {
    meta.textContent = `0 results · ${data.indexed} clippings indexed`;
    host.innerHTML = '<p class="empty">Nothing matched. Try fewer words, or drop the filters.</p>';
    return;
  }

  const shown = data.offset + data.results.length;
  meta.textContent = `${data.total} result${data.total === 1 ? '' : 's'} · showing ${data.offset + 1}-${shown} · ${
    data.indexed
  } clippings indexed`;

  const pager =
    data.total > shown || data.offset > 0
      ? `<div class="pager">
           ${data.offset > 0 ? '<button class="ghost-btn" data-page="prev">Previous</button>' : ''}
           ${data.total > shown ? '<button class="ghost-btn" data-page="next">Next</button>' : ''}
         </div>`
      : '';

  host.innerHTML = `<section class="panel">${data.results.map(resultRow).join('')}${pager}</section>`;
}

async function runSearch({ offset = 0 } = {}) {
  const params = new URLSearchParams();
  const q = $('#search-q').value.trim();
  const theme = $('#search-theme').value;
  const kind = $('#search-kind').value;
  if (q) params.set('q', q);
  if (theme) params.set('theme', theme);
  if (kind) params.set('kind', kind);
  params.set('offset', String(offset));

  $('#search-meta').textContent = 'Searching…';
  try {
    const data = await getJson(`/api/search?${params}`);
    state.search = { query: { q, theme, kind }, offset, total: data.total, results: data.results, indexed: data.indexed };
  } catch (err) {
    state.search = { query: { q, theme, kind }, offset: 0, total: 0, results: [], indexed: 0 };
    $('#search-meta').textContent = `Search failed: ${err.message}`;
  }
  renderSearch();
}

async function populateTopicSelect() {
  if (!state.topics) state.topics = await getJson('/api/topics');
  const select = $('#search-theme');
  const current = select.value;
  select.innerHTML =
    '<option value="">Any topic</option>' +
    state.topics.topics.map((t) => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('');
  select.value = current;
}

/* ---- rendering: archive ---------------------------------------------- */

function clipRow(story) {
  return `
    <div class="clip">
      <div class="clip-top">
        <span class="clip-source">${esc(story.sourceName)}</span>
        <span>${esc(formatStamp(story.publishedAt))}</span>
        ${(story.themes || []).slice(0, 2).map((t) => `<span>${esc(t.label)}</span>`).join('')}
      </div>
      <h4 class="clip-title"><a href="${safeUrl(story.url)}" target="_blank" rel="noopener noreferrer">${esc(
        story.title,
      )}</a></h4>
      <p class="clip-summary">${esc(story.summary)}</p>
    </div>`;
}

function matchesFilter(story, needle) {
  if (!needle) return true;
  return `${story.title} ${story.summary} ${story.sourceName} ${(story.themes || [])
    .map((t) => t.label)
    .join(' ')}`
    .toLowerCase()
    .includes(needle);
}

/** The week condensed: what held, what appeared, what went quiet. */
function renderWeekly() {
  const data = state.weekly;
  if (!data) return '';

  if (!data.ready) {
    return `<section class="panel">
      <div class="panel-head"><h3>The week in review</h3></div>
      <p class="prose">Needs at least two editions in the last ${data.days} days. It fills in as the
      archive builds — currently ${data.editions}.</p>
    </section>`;
  }

  const range = `${formatStamp(data.from)} → ${formatStamp(data.to)}`;
  const group = (title, rows, render) =>
    rows.length
      ? `<div class="mini">
           <div class="mini-label">${esc(title)}</div>
           <ul class="week-list">${rows.map(render).join('')}</ul>
         </div>`
      : '';

  return `
    <section class="panel">
      <div class="panel-head">
        <h3>The week in review</h3>
        <span class="hint">${esc(range)} · ${data.editions} editions · ${data.storiesPublished} clippings</span>
      </div>

      <div class="grid-2">
        ${group(
          'Held all week',
          data.persisted,
          (t) => `<li><span class="week-name">${esc(t.label)}</span><span class="week-n">${t.presence}/${t.total} editions</span></li>`,
        )}
        ${group(
          'Newly emerging',
          data.emerged,
          (t) => `<li><span class="week-name">${esc(t.label)}</span><span class="week-n up">+${t.change}</span></li>`,
        )}
        ${group(
          'Gone quiet',
          data.faded,
          (t) => `<li><span class="week-name">${esc(t.label)}</span><span class="week-n down">${t.change}</span></li>`,
        )}
        ${group(
          'Names that kept recurring',
          data.actors,
          (a) =>
            `<li><span class="week-name">${
              a.story
                ? `<a href="${safeUrl(a.story.url)}" target="_blank" rel="noopener noreferrer">${esc(a.label)}</a>`
                : esc(a.label)
            }</span><span class="week-n">${a.editions} editions</span></li>`,
        )}
      </div>

      ${
        data.cves.length
          ? `<h4 class="subsection-head">Vulnerabilities that stayed in the news</h4>
             <div class="pill-row" style="margin-top:9px">${data.cves
               .map(
                 (c) =>
                   `<a class="pill" href="${safeUrl(c.story?.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(
                     c.label,
                   )}</b><span class="n">${c.editions} editions</span></a>`,
               )
               .join('')}</div>`
          : ''
      }
    </section>`;
}

function renderArchive() {
  const host = $('#archive-body');
  const data = state.archive;
  if (!data) return;

  const weeklyHtml = renderWeekly();

  if (!data.editions.length) {
    host.innerHTML = weeklyHtml + `<p class="empty">The archive fills as editions roll over. The first archived edition
      appears after the next refresh${data.current ? ` — the current edition is ${esc(data.current.id)}.` : '.'}</p>`;
    return;
  }

  const needle = state.archiveFilter.trim().toLowerCase();

  const rows = data.editions.map((edition) => {
    const cached = state.editionCache.get(edition.id);
    const matches = needle && cached ? cached.stories.filter((story) => matchesFilter(story, needle)) : null;

    // While filtering, an edition opens itself when it has something to show.
    const isOpen = needle ? Boolean(matches?.length) : state.openEditions.has(edition.id);

    let body = '<p class="clip-summary">Loading clippings…</p>';
    if (cached) {
      const stories = matches ?? cached.stories;
      body = stories.length
        ? stories.map(clipRow).join('')
        : '<p class="clip-summary">No clippings in this edition match the filter.</p>';
    }

    const count = needle
      ? cached
        ? `${matches.length} of ${edition.storyCount} match`
        : 'searching…'
      : `${edition.storyCount} clippings`;

    return `
      <div class="edition" data-open="${isOpen}" data-id="${esc(edition.id)}">
        <button class="edition-head" aria-expanded="${isOpen}">
          <span class="edition-stamp">${esc(edition.id)}</span>
          <span class="edition-when">${esc(formatStamp(edition.createdAt))}</span>
          <span class="edition-count">${esc(count)}</span>
          <span class="edition-lead">${esc(edition.leadHeadline?.title || '')}</span>
          <span class="edition-caret">▸</span>
        </button>
        <div class="edition-body">${body}</div>
      </div>`;
  });

  host.innerHTML = weeklyHtml + rows.join('');
}

/** Fetch the editions a search needs, newest first and bounded. */
async function loadArchiveForSearch(limit = 20) {
  const pending = (state.archive?.editions || [])
    .filter((edition) => !state.editionCache.has(edition.id))
    .slice(0, limit);
  if (!pending.length) return;

  for (const edition of pending) {
    try {
      state.editionCache.set(edition.id, await getJson(`/api/edition/${encodeURIComponent(edition.id)}`));
    } catch {
      state.editionCache.set(edition.id, { stories: [] });
    }
    // Re-render as each edition lands so results appear progressively.
    if (state.archiveFilter.trim()) renderArchive();
  }
  renderArchive();
}

async function toggleEdition(id) {
  if (state.openEditions.has(id)) {
    state.openEditions.delete(id);
    renderArchive();
    return;
  }
  state.openEditions.add(id);
  renderArchive();

  if (!state.editionCache.has(id)) {
    try {
      const edition = await getJson(`/api/edition/${encodeURIComponent(id)}`);
      state.editionCache.set(id, edition);
    } catch {
      state.editionCache.set(id, { stories: [] });
    }
    renderArchive();
  }
}

/* ---- rendering: sources ---------------------------------------------- */

const KIND_TITLES = {
  authority: 'Government & national authorities',
  journalism: 'Journalism',
  research: 'Vendor & lab research',
  practitioner: 'Practitioners & analysis',
};

function renderSources() {
  const host = $('#sources-body');
  const data = state.sources;
  if (!data) return;

  host.innerHTML = Object.entries(KIND_TITLES)
    .map(([kind, title]) => {
      const group = data.sources.filter((source) => source.kind === kind);
      if (!group.length) return '';
      return `
        <div class="source-group">
          <h3>${esc(title)} <span class="source-count">${group.length}</span></h3>
          <div class="source-list">
            ${group
              .map(
                (source) => `
              <div class="source">
                <span class="source-dot" data-ok="${source.lastOk}"></span>
                <a class="source-name" href="${safeUrl(source.site || source.url)}" target="_blank" rel="noopener noreferrer">${esc(
                  source.name,
                )}</a>
                <span class="source-stat">${
                  source.lastOk === null
                    ? 'not polled'
                    : source.lastOk
                      ? `${source.lastCount} items`
                      : esc(source.lastError || 'failed')
                }</span>
              </div>`,
              )
              .join('')}
          </div>
        </div>`;
    })
    .join('');
}

/* ---- status ---------------------------------------------------------- */

function renderStatus() {
  const status = state.status;
  if (!status) return;

  $('#stat-edition').textContent = status.editionId || 'building…';
  $('#stat-sources').textContent = status.lastRun
    ? `${status.lastRun.sourcesOk}/${status.lastRun.sourcesTotal} live`
    : `${status.sourceCount}`;

  const pulse = $('#pulse');
  const label = $('#stat-state');
  if (status.refreshing) {
    pulse.dataset.state = 'working';
    label.textContent = 'Refreshing…';
  } else if (status.lastError) {
    pulse.dataset.state = 'error';
    label.textContent = 'Last refresh failed';
  } else {
    pulse.dataset.state = 'live';
    label.textContent = 'Live';
  }

  $('#footer-meta').textContent = status.lastRun
    ? `Last cycle: ${status.lastRun.itemsFetched} items polled · ${status.lastRun.corpusSize} unique · ` +
      `${status.lastRun.published} published · ${(status.lastRun.durationMs / 1000).toFixed(1)}s · ` +
      `${status.editionCount} edition${status.editionCount === 1 ? '' : 's'} on record`
    : '';
}

function tickCountdown() {
  if (!state.status) return;
  $('#stat-countdown').textContent = state.status.refreshing ? 'running' : countdown(state.status.nextRefreshAt);
}

/* ---- connect sheet ----------------------------------------------------- */

async function openConnect() {
  const sheet = $('#connect-sheet');
  const body = $('#connect-body');
  sheet.showModal();
  body.textContent = 'Loading…';

  let data;
  try {
    data = await getJson('/api/connect');
  } catch (err) {
    body.innerHTML = `<p class="prose">Could not read the network details: ${esc(err.message)}</p>`;
    return;
  }

  const rows = data.urls
    .map(
      (u) => `
      <li class="url-row">
        <code>${esc(u.url)}</code>
        <button class="ghost-btn copy-btn" data-copy="${esc(u.url)}">Copy</button>
        <span class="url-note">${esc(u.label)}</span>
      </li>`,
    )
    .join('');

  body.innerHTML = `
    ${
      data.lanReady
        ? `<div class="qr-wrap">${data.qr}</div>
           <p class="prose" style="text-align:center">${
             data.anywhere
               ? 'Scan with your phone. Works anywhere, as long as Tailscale is on.'
               : 'Scan with your phone. Works on this Wi-Fi only.'
           }</p>`
        : `<div class="notice">
             <strong>Reachable from this machine only.</strong>
             The server is bound to loopback, so a phone on the same network cannot see it.
             To open it up, run:
             <code class="block">HOST=0.0.0.0 npm run service:install</code>
             Then reopen this panel for a QR code.
           </div>`
    }

    <ul class="url-list">${rows}</ul>

    <div class="install-note">
      <strong>Install it like an app</strong>
      <p><em>iPhone / iPad:</em> open the address in Safari, tap Share, then <em>Add to Home Screen</em>.</p>
      <p><em>Android:</em> open in Chrome, then <em>Install app</em> from the menu.</p>
      <p><em>This Mac:</em> run <code>sentinel</code> in a terminal from anywhere.</p>
    </div>`;
}

/* ---- view routing ---------------------------------------------------- */

const LOADERS = {
  briefing: async () => {
    if (!state.briefing) {
      state.briefing = await getJson('/api/briefing');
    }
    renderBriefing();
  },
  insights: async () => {
    if (!state.briefing) state.briefing = await getJson('/api/briefing');
    renderInsights();
  },
  trends: async () => {
    const [trends, skills] = await Promise.all([getJson('/api/trends'), getJson('/api/skills')]);
    state.trends = trends;
    state.skills = skills;
    renderTrends();
  },
  search: async () => {
    await populateTopicSelect();
    renderSearch();
  },
  archive: async () => {
    const [archive, weekly] = await Promise.all([getJson('/api/archive'), getJson('/api/weekly')]);
    state.archive = archive;
    state.weekly = weekly;
    renderArchive();
  },
  sources: async () => {
    if (!state.sources) state.sources = await getJson('/api/sources');
    renderSources();
  },
};

async function showView(name, { force = false } = {}) {
  // Lets the stylesheet quieten the chrome on the briefing's cover.
  document.documentElement.dataset.view = name;
  $$('.tab').forEach((tab) => {
    const active = tab.dataset.view === name;
    tab.classList.toggle('is-active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  $$('.view').forEach((view) => {
    const active = view.id === `view-${name}`;
    view.classList.toggle('is-active', active);
    view.hidden = !active;
  });

  if (location.hash.slice(1) !== name) history.replaceState(null, '', `#${name}`);

  if (force || !state.loadedViews.has(name)) {
    try {
      await LOADERS[name]();
      state.loadedViews.add(name);
    } catch (err) {
      const host =
        name === 'briefing'
          ? $('#briefing-empty')
          : name === 'search'
            ? $('#search-results')
            : $(`#${name}-body`) || $('#briefing-empty');
      const message =
        err.status === 503
          ? 'The first edition is still being built — this takes about ten seconds. Reload shortly.'
          : `Could not load this view: ${err.message}`;
      if (host) {
        host.hidden = false;
        host.className = 'empty';
        host.textContent = message;
      }
    }
  }
}

/* ---- polling --------------------------------------------------------- */

async function pollStatus() {
  try {
    const status = await getJson('/api/status');
    const previousEdition = state.status?.editionId;
    state.status = status;
    renderStatus();
    tickCountdown();

    // A new edition landed: refresh whatever the reader is looking at.
    if (previousEdition && status.editionId && status.editionId !== previousEdition) {
      state.briefing = null;
      state.trends = null;
      state.skills = null;
      state.weekly = null;
      await loadProfile({ register: true });
      state.topics = null;
      state.entity = null;
      state.editionCache.clear();
      state.loadedViews.clear();
      const current = $('.tab.is-active')?.dataset.view || 'briefing';
      await showView(current, { force: true });
    }
  } catch {
    /* transient - the next poll will pick it up */
  }
}

/* ---- boot ------------------------------------------------------------ */

function bindEvents() {
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  });

  // Opening a story marks it read, wherever it was clicked from.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="http"]');
    if (!link) return;
    const holder = link.closest('[data-story]');
    if (holder) markStoryRead(holder.dataset.story);
    else if (link.id === 'sitrep-lead' || link.closest('#sitrep-lead')) {
      const lead = state.briefing?.stories?.[0];
      if (lead) markStoryRead(lead.id);
    }
  });

  $$('#seg-unread .seg-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.unreadFilter = button.dataset.unread;
      $$('#seg-unread .seg-btn').forEach((b) => b.classList.toggle('is-active', b === button));
      renderBriefing();
    });
  });

  $('#mark-all-read').addEventListener('click', async () => {
    const updated = await postProfile('/api/profile/read', { all: true });
    if (updated && state.profile) Object.assign(state.profile, updated);
    renderBriefing();
  });

  // Follow toggles live in the topic sections and in the Trends ledgers.
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('.follow-btn');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const { watchBucket, watchKey } = button.dataset;
    const on = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? '★' : '☆';
    const updated = await postProfile('/api/profile/watch', { bucket: watchBucket, key: watchKey, on });
    if (updated && state.profile) Object.assign(state.profile, updated);
    renderWatchLine();
  });

  const explainBtn = $('#explain-toggle');
  explainBtn.addEventListener('click', async () => {
    state.explain = !state.explain;
    explainBtn.setAttribute('aria-pressed', String(state.explain));
    try {
      localStorage.setItem('sentinel-explain', state.explain ? 'on' : 'off');
    } catch {
      /* per-visit only if storage is unavailable */
    }
    if (state.explain) await loadGlossary();
    else closeTermPop();
    renderBriefing();
    if (state.loadedViews.has('insights')) renderInsights();
  });

  // Insights: the in-page jump bar, and its hand-off to Trends.
  $('#insights-body').addEventListener('click', (event) => {
    const jump = event.target.closest('[data-jump]');
    if (jump) {
      document.getElementById(jump.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const goto = event.target.closest('[data-goto]');
    if (goto) {
      showView(goto.dataset.goto);
      window.scrollTo({ top: 0 });
    }
  });

  const easiestBtn = $('#easiest-first');
  easiestBtn.addEventListener('click', () => {
    state.easiestFirst = !state.easiestFirst;
    easiestBtn.setAttribute('aria-pressed', String(state.easiestFirst));
    renderBriefing();
  });

  // One delegated handler covers every annotated term on the page.
  document.addEventListener('click', (event) => {
    const term = event.target.closest('.term');
    if (term) {
      event.preventDefault();
      event.stopPropagation();
      if (term.getAttribute('aria-expanded') === 'true') closeTermPop();
      else {
        closeTermPop();
        openTermPop(term);
      }
      return;
    }
    if (!event.target.closest('#term-pop')) closeTermPop();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeTermPop();
  });
  window.addEventListener('scroll', closeTermPop, { passive: true });

  $('#connect-open').addEventListener('click', openConnect);
  $('#connect-close').addEventListener('click', () => $('#connect-sheet').close());
  $('#connect-sheet').addEventListener('click', (event) => {
    // Clicking the backdrop closes the sheet.
    if (event.target.id === 'connect-sheet') $('#connect-sheet').close();
    const copy = event.target.closest('.copy-btn');
    if (copy) {
      navigator.clipboard?.writeText(copy.dataset.copy).then(() => {
        copy.textContent = 'Copied';
        setTimeout(() => {
          copy.textContent = 'Copy';
        }, 1600);
      });
    }
  });

  $('#briefing-sections').addEventListener('click', (event) => {
    const head = event.target.closest('.section-head');
    if (!head) return;
    const id = head.dataset.section;
    if (state.openSections.has(id)) state.openSections.delete(id);
    else state.openSections.add(id);
    // Toggle in place so the page does not jump under the reader.
    const section = head.closest('.section');
    const open = state.openSections.has(id);
    section.dataset.open = String(open);
    head.setAttribute('aria-expanded', String(open));
  });

  $('#trends-body').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-entity]');
    if (!button) return;
    showEntity(button.dataset.entity, button.dataset.key);
  });

  $('#search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch({ offset: 0 });
  });

  $('#search-results').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button) return;
    const size = state.search.results.length || 60;
    const next = button.dataset.page === 'next' ? state.search.offset + size : Math.max(0, state.search.offset - size);
    runSearch({ offset: next });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  $('#archive-body').addEventListener('click', (event) => {
    const head = event.target.closest('.edition-head');
    if (!head) return;
    toggleEdition(head.closest('.edition').dataset.id);
  });

  let filterTimer;
  $('#archive-search').addEventListener('input', (event) => {
    clearTimeout(filterTimer);
    const value = event.target.value;
    filterTimer = setTimeout(async () => {
      state.archiveFilter = value;
      renderArchive();
      // Searching should cover the whole archive, not only the editions the
      // reader happened to open, so pull in the ones not yet cached.
      if (value.trim()) await loadArchiveForSearch();
    }, 200);
  });

  const fxToggle = $('#fx-toggle');
  fxToggle.addEventListener('click', () => {
    const on = document.documentElement.dataset.fx !== 'off';
    document.documentElement.dataset.fx = on ? 'off' : 'on';
    fxToggle.setAttribute('aria-pressed', String(!on));
    try {
      localStorage.setItem('sentinel-fx', on ? 'off' : 'on');
    } catch {
      /* storage may be unavailable; the toggle still works for this visit */
    }
  });

  window.addEventListener('hashchange', () => {
    const name = location.hash.slice(1);
    if (LOADERS[name]) showView(name);
  });
}

async function restoreExplain() {
  try {
    if (localStorage.getItem('sentinel-explain') === 'on') {
      state.explain = true;
      $('#explain-toggle').setAttribute('aria-pressed', 'true');
      await loadGlossary();
    }
  } catch {
    /* ignore */
  }
}

const THEMES = new Set(['hud', 'breach', 'signal']);
const DEFAULT_THEME = 'hud';

/**
 * Switch the look. An unknown or retired theme - one saved before the list
 * changed - falls back to the default. The browser bar follows the theme's
 * own background.
 */
function applyTheme(name) {
  const theme = THEMES.has(name) ? name : DEFAULT_THEME;
  document.documentElement.dataset.theme = theme;
  $('#theme-select').value = theme;
  const background = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
  if (background) $('meta[name="theme-color"]')?.setAttribute('content', background);
}

function restoreTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem('sentinel-theme');
  } catch {
    /* ignore */
  }
  applyTheme(saved);
  $('#theme-select').addEventListener('change', (event) => {
    applyTheme(event.target.value);
    try {
      localStorage.setItem('sentinel-theme', event.target.value);
    } catch {
      /* per-visit only if storage is unavailable */
    }
  });
}

function restoreFx() {
  try {
    if (localStorage.getItem('sentinel-fx') === 'off') {
      document.documentElement.dataset.fx = 'off';
      $('#fx-toggle').setAttribute('aria-pressed', 'false');
    }
  } catch {
    /* ignore */
  }
}

async function boot() {
  restoreTheme();
  restoreFx();
  bindEvents();
  await restoreExplain();
  $('#briefing-grid').innerHTML = Array.from({ length: 4 }, () => '<div class="skeleton"></div>').join('');

  await pollStatus();
  // Registering the visit settles what counts as new before anything paints.
  await loadProfile({ register: true });
  const initial = LOADERS[location.hash.slice(1)] ? location.hash.slice(1) : 'briefing';
  await showView(initial);

  setInterval(pollStatus, 60000);
  setInterval(tickCountdown, 1000);
}

boot();
