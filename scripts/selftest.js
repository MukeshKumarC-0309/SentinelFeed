/**
 * Offline checks for the parsing, summarising and analysis logic.
 * No network access - runs in well under a second.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import { decodeEntities, tagText, extractEntries, attr, findFirst } from '../src/xml.js';
import { htmlToText, splitSentences, metaContent } from '../src/html.js';
import { buildSummary } from '../src/summary.js';
import { canonicalUrl, dedupeKey, isSecurityRelevant } from '../src/feeds.js';
import { clusterDuplicates, matchThemes, scoreItem, titleTokens, proseScore } from '../src/analyze.js';
import { buildInsights } from '../src/insights.js';
import { THEMES, SKILLS } from '../src/taxonomy.js';
import { themeTrends, entityLeaderboard, entityDetail, searchClippings, skillTrends, weeklyReview } from '../src/aggregate.js';
import { publicView, watchActivity } from '../src/profile.js';
import { renderRss, renderDigestText } from '../src/syndicate.js';
import { urgentStories } from '../src/notify.js';
import { RateLimiter, isLoopback, presentedToken } from '../src/security.js';
import { config } from '../src/config.js';
import { SOURCES } from '../src/sources.js';
import { RefreshAbandoned } from '../src/pipeline.js';
import { encodeQr, ecCodewords, qrSvg } from '../src/qr.js';
import { GLOSSARY, glossaryIndex } from '../src/glossary.js';
import { isTailnetIPv4 } from '../src/network.js';
import { writeJsonAtomic } from '../src/atomic.js';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ${err.message}`);
  }
}

console.log('\nSENTINEL FEED self-test\n');

/* ---- XML ------------------------------------------------------------- */

test('decodes named, numeric and double-encoded entities', () => {
  assert.equal(decodeEntities('a &amp; b'), 'a & b');
  assert.equal(decodeEntities('&#8212;'), '—');
  assert.equal(decodeEntities('&#x2014;'), '—');
  assert.equal(decodeEntities('&lt;p&gt;hi&lt;/p&gt;'), '<p>hi</p>');
  assert.equal(decodeEntities('&amp;nbsp;').trim(), '');
});

test('reads CDATA and namespaced tags', () => {
  const item = '<item><title><![CDATA[Hi & bye]]></title><dc:creator>Ada</dc:creator></item>';
  assert.equal(tagText(item, 'title'), 'Hi & bye');
  assert.equal(tagText(item, 'creator'), 'Ada');
});

test('handles Atom entries and self-closing links', () => {
  const atom = '<entry><title type="html">T&amp;A</title><link href="https://a.example/b" rel="alternate"/></entry>';
  assert.equal(extractEntries(atom).length, 1);
  assert.equal(tagText(atom, 'title'), 'T&A');
  assert.equal(attr(findFirst(atom, 'link').attrs, 'href'), 'https://a.example/b');
});

/* ---- HTML ------------------------------------------------------------ */

test('strips markup, scripts and feed boilerplate', () => {
  const html = '<p>Real text here.</p><script>alert(1)</script><p>The post X appeared first on Y</p>';
  const text = htmlToText(html);
  assert.equal(text, 'Real text here.');
  assert.ok(!text.includes('alert'));
});

test('does not split sentences on abbreviations or decimals', () => {
  const sentences = splitSentences('CVSS 9.8 is critical. The U.S. agency responded. Done.');
  assert.equal(sentences.length, 3);
  assert.ok(sentences[0].includes('9.8'));
  assert.ok(sentences[1].includes('U.S.'));
});

test('reads meta description in either attribute order', () => {
  assert.equal(metaContent('<meta property="og:description" content="Hello">', 'og:description'), 'Hello');
  assert.equal(metaContent('<meta content="Hi" name="description">', 'description'), 'Hi');
});

/* ---- Summaries ------------------------------------------------------- */

test('builds a multi-sentence summary and flags thin ones', () => {
  const long = Array.from({ length: 9 }, (_, i) => `Sentence number ${i} carries enough detail to matter here.`).join(' ');
  const rich = buildSummary(long, { title: 'Headline' });
  assert.ok(rich.text.length >= 340, `expected a full summary, got ${rich.text.length}`);
  assert.equal(rich.needsEnrichment, false);

  const thin = buildSummary('<p>Too short.</p>', { title: 'Headline' });
  assert.equal(thin.needsEnrichment, true);
});

test('never ends a summary mid-word', () => {
  const truncated = 'A vulnerability was disclosed today. The flaw allows an attacker to reach the';
  const { text } = buildSummary(truncated, { title: 'Flaw' });
  assert.ok(/[.!?…)"”’]\s*$/.test(text), `ended badly: ${JSON.stringify(text.slice(-40))}`);
});

test('does not run publisher-truncated text into enrichment text', () => {
  const feed = 'First sentence is complete. The quote begins and is cut off at';
  const article = 'Attackers exploited the bug in production systems this week.';
  const { text } = buildSummary(feed, { title: 'Bug', extra: article });
  assert.ok(!text.includes('cut off at Attackers'), `run-on produced: ${text}`);
});

/* ---- URLs and relevance ---------------------------------------------- */

test('cleans tracking parameters without moving the link', () => {
  const url = canonicalUrl('https://www.example.com/a/b?utm_source=rss&id=7#frag');
  assert.ok(url.startsWith('https://www.example.com/a/b'), url);
  assert.ok(url.includes('id=7'));
  assert.ok(!url.includes('utm_source'));
  assert.ok(!url.includes('#frag'));
});

test('treats www and trailing-slash variants as the same page', () => {
  assert.equal(dedupeKey('https://www.example.com/a/'), dedupeKey('https://example.com/a'));
});

test('filters general-interest items by topic', () => {
  assert.equal(isSecurityRelevant('New ransomware campaign hits hospitals'), true);
  assert.equal(isSecurityRelevant('A review of the new coffee machine'), false);
});

/* ---- Analysis --------------------------------------------------------- */

const story = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  title: 'Generic story',
  url: `https://example.com/${Math.random().toString(36).slice(2)}`,
  summary: 'A generic summary of an event that took place recently and matters to defenders.',
  sourceId: 'x',
  sourceName: 'Example',
  sourceKind: 'journalism',
  sourceWeight: 1.2,
  publishedAt: new Date().toISOString(),
  categories: [],
  themes: [],
  ...over,
});

test('matches themes from story language', () => {
  const ids = matchThemes(story({ title: 'Ransomware gang leaks stolen data', summary: 'Double extortion continues.' })).map((t) => t.id);
  assert.ok(ids.includes('ransomware'), ids.join(','));

  const ai = matchThemes(story({ title: 'Prompt injection hijacks AI browser agent', summary: 'Indirect prompt injection abused.' })).map((t) => t.id);
  assert.ok(ai.includes('ai-offense'), ai.join(','));
});

test('ranks urgent, corroborated stories above routine ones', () => {
  const urgent = story({
    title: 'Zero-day actively exploited in the wild',
    summary: 'An unauthenticated remote code execution flaw is under active attack. '.repeat(5),
    alsoReportedBy: [{ sourceName: 'A', url: 'https://a.example/1', title: 'A' }],
  });
  urgent.themes = matchThemes(urgent);
  const routine = story({ title: 'Vendor publishes quarterly report', summary: 'Routine coverage of a business update with sufficient length to pass the floor test.' });
  routine.themes = matchThemes(routine);

  assert.ok(scoreItem(urgent).score > scoreItem(routine).score);
  assert.ok(scoreItem(urgent).signals.includes('Active exploitation'));
});

test('clusters cross-outlet reports of one CVE and keeps their links', () => {
  const a = story({
    title: 'Cisco warns of ISE zero-day exploited in attacks',
    summary: 'The flaw is tracked as CVE-2026-76460 and allows authentication bypass.',
    sourceName: 'Outlet A',
    sourceWeight: 1.3,
    url: 'https://a.example/cisco',
  });
  const b = story({
    title: 'Cisco patches max-severity ISE flaw this week',
    summary: 'Cisco released a fix for CVE-2026-76460, rated 10.0, after exploitation was seen in the wild by researchers.',
    sourceName: 'Outlet B',
    sourceWeight: 1.2,
    url: 'https://b.example/cisco',
  });
  const unrelated = story({ title: 'Phishing campaign targets universities', url: 'https://c.example/phish' });

  const clustered = clusterDuplicates([a, b, unrelated]);
  assert.equal(clustered.length, 2, `expected 2 clusters, got ${clustered.length}`);
  const merged = clustered.find((s) => s.alsoReportedBy?.length);
  assert.ok(merged, 'expected one cluster to carry corroboration');
  assert.equal(merged.alsoReportedBy.length, 1);
  assert.ok(merged.alsoReportedBy[0].url.startsWith('http'));
});

test('does not cluster round-ups that list many CVEs', () => {
  const roundup = story({
    title: 'Patch Tuesday fixes many bugs',
    summary: 'Includes CVE-2026-0001, CVE-2026-0002, CVE-2026-0003 and CVE-2026-0004 across products.',
    url: 'https://a.example/roundup',
  });
  const single = story({
    title: 'Critical flaw patched in product',
    summary: 'The issue, CVE-2026-0001, allows remote code execution against exposed servers.',
    url: 'https://b.example/single',
  });
  assert.equal(clusterDuplicates([roundup, single]).length, 2);
});

test('scores narrative prose above a structured advisory dump', () => {
  const advisory =
    'Serial Number: AV26-902 Date: September 9, 2026 Updated: September 22, 2026 As of September 9, 2026, Check Point is affected by vulnerabilities in the following products: Security Gateway Multiple versions Check Point Spark Firewall Multiple versions Security Management Server Multiple versions Update 1 CVE-2026-85102 and CVE-2026-93616 are exploited in the wild.';
  const newsroom =
    'Check Point has fixed an actively exploited flaw that lets unauthenticated attackers upload and run scripts on vulnerable servers. The company released emergency hotfixes this week. Attackers can abuse the flaw without logging in. A compromise could reach the wider enterprise network.';

  assert.ok(proseScore(newsroom) > 0.9, `newsroom scored ${proseScore(newsroom)}`);
  assert.ok(proseScore(advisory) < 0.5, `advisory scored ${proseScore(advisory)}`);
  assert.ok(proseScore(newsroom) > proseScore(advisory));
});

test('the newsroom write-up wins the clipping slot over the advisory', () => {
  const advisory = story({
    title: 'Check Point security advisory (AV26-902)',
    summary:
      'Serial Number: AV26-902 Date: September 9, 2026 Updated: September 22, 2026 Check Point is affected by vulnerabilities in the following products: Security Gateway Multiple versions Security Management Server Multiple versions CVE-2026-93616 exploited in the wild.',
    sourceName: 'Canadian Centre for Cyber Security',
    sourceKind: 'authority',
    sourceWeight: 1.6,
    url: 'https://a.example/advisory',
  });
  const newsroom = story({
    title: 'Check Point patches actively exploited flaw in management servers',
    summary:
      'Check Point has fixed an actively exploited flaw tracked as CVE-2026-93616 that lets unauthenticated attackers run scripts on management servers. Emergency hotfixes are available now. Attackers can abuse the flaw without logging in. A compromise could reach the wider network.',
    sourceName: 'BleepingComputer',
    sourceKind: 'journalism',
    sourceWeight: 1.6,
    url: 'https://b.example/checkpoint',
  });

  const [clipping] = clusterDuplicates([advisory, newsroom]);
  assert.equal(clipping.sourceName, 'BleepingComputer', 'the readable write-up should lead');
  // The advisory is kept, not discarded.
  assert.equal(clipping.alsoReportedBy.length, 1);
  assert.equal(clipping.alsoReportedBy[0].sourceName, 'Canadian Centre for Cyber Security');
});

test('clusters differently-worded coverage of one event via rare names', () => {
  const a = story({
    title: 'ShinyHunters claims FBI hack, data theft in PeopleSoft zero-day breach',
    summary: 'The extortion group says it breached systems using an Oracle PeopleSoft flaw.',
    sourceName: 'Outlet A',
    url: 'https://a.example/shiny-1',
  });
  const b = story({
    title: "ShinyHunters claims FBI hack: 'This is NOT financially motivated'",
    summary: 'The group told reporters its PeopleSoft intrusion was not about money.',
    sourceName: 'Outlet B',
    url: 'https://b.example/shiny-2',
  });
  const unrelated = story({ title: 'Cisco patches firewall flaw', url: 'https://c.example/cisco' });

  const clusters = clusterDuplicates([a, b, unrelated]);
  assert.equal(clusters.length, 2, `expected 2 clusters, got ${clusters.length}`);
  assert.ok(clusters.some((c) => c.alsoReportedBy.length === 1), 'the two reports should merge');
});

test('keeps separate incidents by the same actor apart', () => {
  // Both mention one rare name (the gang) but nothing else distinctive.
  const first = story({ title: 'Akira ransomware hits Ohio water utility', url: 'https://a.example/1' });
  const second = story({ title: 'Akira ransomware claims Danish logistics firm', url: 'https://b.example/2' });
  assert.equal(clusterDuplicates([first, second]).length, 2);
});

test('tokenises headlines without stopwords', () => {
  const tokens = titleTokens('The new attack on the server');
  assert.ok(!tokens.has('the'));
  assert.ok(tokens.has('attack'));
});

/* ---- Insights --------------------------------------------------------- */

test('derives themes, skills and mindsets only from matched stories', () => {
  const items = [
    story({ title: 'Ransomware gang extorts hospital', summary: 'Double extortion and a leak site were used.' }),
    story({ title: 'Prompt injection hijacks AI agent in browser', summary: 'Indirect prompt injection abused by attackers.' }),
    story({ title: 'Zero-day actively exploited in VPN appliance', summary: 'Added to the KEV catalog after in-the-wild exploitation.' }),
  ].map((item) => {
    item.themes = matchThemes(item);
    return Object.assign(item, scoreItem(item));
  });

  const insights = buildInsights(items, { sourceCount: 35, windowHours: 72 });
  assert.ok(insights.themes.length > 0);
  assert.ok(insights.skills.length > 0);
  assert.ok(insights.mindsets.length > 0);
  assert.ok(insights.outlook.lede.includes('35 sources'));

  // Shares should total roughly 100% across matched themes.
  const total = insights.themes.reduce((sum, t) => sum + t.share, 0);
  assert.ok(Math.abs(total - 100) < 1.5, `shares total ${total}`);

  // Every skill must trace back to a defined theme and carry evidence.
  for (const skill of insights.skills) {
    assert.ok(SKILLS[skill.id], `unknown skill ${skill.id}`);
    assert.ok(skill.drivenBy.length > 0);
  }
});

test('reports momentum against the previous edition', () => {
  const items = [story({ title: 'Ransomware attack halts production', summary: 'Extortion demand followed encryption of systems.' })].map((item) => {
    item.themes = matchThemes(item);
    return Object.assign(item, scoreItem(item));
  });
  const first = buildInsights(items, { sourceCount: 1 });
  assert.equal(first.themes[0].momentum.direction, 'new');

  const second = buildInsights(items, { sourceCount: 1, previousShares: { [first.themes[0].id]: 0.01 } });
  assert.notEqual(second.themes[0].momentum.direction, 'new');
  assert.equal(typeof second.themes[0].momentum.delta, 'number');
});

test('returns an empty-but-valid shape when nothing matches', () => {
  const insights = buildInsights([], { sourceCount: 0 });
  assert.deepEqual(insights.themes, []);
  assert.deepEqual(insights.skills, []);
  assert.ok(typeof insights.outlook.lede === 'string');
});

/* ---- Taxonomy integrity ---------------------------------------------- */

test('taxonomy is internally consistent', () => {
  const ids = new Set();
  for (const theme of THEMES) {
    assert.ok(!ids.has(theme.id), `duplicate theme id ${theme.id}`);
    ids.add(theme.id);
    assert.ok(theme.match.length > 0, `${theme.id} has no patterns`);
    assert.ok(theme.implication && theme.horizon && theme.mindset, `${theme.id} missing prose`);
    for (const skill of theme.skills) assert.ok(SKILLS[skill], `${theme.id} references unknown skill ${skill}`);
  }
  const referenced = new Set(THEMES.flatMap((t) => t.skills));
  for (const id of Object.keys(SKILLS)) assert.ok(referenced.has(id), `skill ${id} is never referenced`);
});


/* ---- Source register -------------------------------------------------- */

test('source register is well formed', () => {
  assert.ok(SOURCES.length >= 100, `expected 100+ sources, got ${SOURCES.length}`);
  const ids = new Set();
  const urls = new Set();
  for (const source of SOURCES) {
    assert.ok(!ids.has(source.id), `duplicate source id ${source.id}`);
    assert.ok(!urls.has(source.url), `duplicate feed url ${source.url}`);
    ids.add(source.id);
    urls.add(source.url);
    assert.ok(/^https:\/\//.test(source.url), `${source.id} is not https`);
    assert.ok(['authority', 'journalism', 'research', 'practitioner'].includes(source.kind), `${source.id} has kind ${source.kind}`);
    assert.equal(typeof source.topical, 'boolean', `${source.id} missing topical flag`);
  }
});

/* ---- Aggregates ------------------------------------------------------- */

const fakeTrends = () => ({
  editions: [
    { id: 'e1', createdAt: '2026-09-18T00:00:00.000Z', storyCount: 10, themes: { ransomware: { share: 5, count: 2, label: 'Ransomware & Extortion' } } },
    { id: 'e2', createdAt: '2026-09-18T12:00:00.000Z', storyCount: 10, themes: { ransomware: { share: 6, count: 3, label: 'Ransomware & Extortion' } } },
    { id: 'e3', createdAt: '2026-09-19T00:00:00.000Z', storyCount: 10, themes: { ransomware: { share: 14, count: 7, label: 'Ransomware & Extortion' } } },
    { id: 'e4', createdAt: '2026-09-19T12:00:00.000Z', storyCount: 10, themes: { ransomware: { share: 16, count: 8, label: 'Ransomware & Extortion' } } },
  ],
  entities: {
    cves: {
      'CVE-2026-0001': {
        key: 'CVE-2026-0001', label: 'CVE-2026-0001', first: '2026-09-18T00:00:00.000Z', last: '2026-09-19T12:00:00.000Z',
        mentions: 5, editions: ['e1', 'e2', 'e3'],
        stories: [{ title: 'A flaw', url: 'https://a.example/1', source: 'X', publishedAt: '2026-09-19T00:00:00.000Z', editionId: 'e3' }],
      },
    },
    actors: {
      clop: {
        key: 'clop', label: 'Clop', first: '2026-09-18T00:00:00.000Z', last: '2026-09-19T12:00:00.000Z',
        mentions: 3, editions: ['e2', 'e4'],
        stories: [{ title: 'Clop strikes', url: 'https://a.example/2', source: 'Y', publishedAt: '2026-09-19T12:00:00.000Z', editionId: 'e4' }],
      },
    },
  },
});

test('theme trends detect direction across the window', () => {
  const result = themeTrends(fakeTrends());
  assert.equal(result.editions.length, 4);
  const theme = result.themes.find((t) => t.id === 'ransomware');
  assert.ok(theme, 'ransomware theme missing');
  assert.equal(theme.series.length, 4);
  assert.equal(theme.current, 16);
  assert.equal(theme.peak, 16);
  // First half averages 5.5, second half 15 - clearly rising.
  assert.equal(theme.direction, 'rising');
  assert.ok(theme.change > 8, `expected a large positive change, got ${theme.change}`);
});

test('theme trends survive an empty store', () => {
  const result = themeTrends({ editions: [], entities: { cves: {}, actors: {} } });
  assert.deepEqual(result.themes, []);
  assert.deepEqual(result.editions, []);
});

test('entity leaderboard ranks by persistence, then volume', () => {
  const rows = entityLeaderboard(fakeTrends(), 'cves');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].editions, 3);
  assert.equal(rows[0].mentions, 5);
});

test('entity lookup is case-insensitive for actors and CVEs', () => {
  const trends = fakeTrends();
  assert.ok(entityDetail(trends, 'actors', 'Clop'));
  assert.ok(entityDetail(trends, 'actors', 'clop'));
  assert.ok(entityDetail(trends, 'cves', 'CVE-2026-0001'));
  assert.equal(entityDetail(trends, 'actors', 'nobody'), null);
});

const fakeSearchStore = () => ({
  clippings: [
    { i: '1', t: 'Ransomware gang hits hospital', u: 'https://a.example/1', s: 'Outlet A', k: 'journalism', d: '2026-09-19T10:00:00.000Z', e: 'e3', h: ['ransomware'], x: 'Extortion demand followed.' },
    { i: '2', t: 'Cisco patches ISE flaw', u: 'https://a.example/2', s: 'Outlet B', k: 'authority', d: '2026-09-18T10:00:00.000Z', e: 'e1', h: ['exploited-edge'], x: 'CVE-2026-76460 was actively exploited in the wild.' },
    { i: '3', t: 'AI agent hijacked', u: 'https://a.example/3', s: 'Outlet A', k: 'research', d: '2026-09-17T10:00:00.000Z', e: 'e0', h: ['ai-offense'], x: 'Prompt injection abused.' },
  ],
});

test('search matches terms, phrases and filters', () => {
  const store = fakeSearchStore();
  assert.equal(searchClippings(store, { q: 'ransomware' }).total, 1);
  assert.equal(searchClippings(store, { q: 'CVE-2026-76460' }).total, 1);
  // Both words must appear, in any order or field.
  assert.equal(searchClippings(store, { q: 'cisco flaw' }).total, 1);
  assert.equal(searchClippings(store, { q: 'cisco ransomware' }).total, 0);
  // A quoted phrase must appear intact.
  assert.equal(searchClippings(store, { q: '"actively exploited"' }).total, 1);
  assert.equal(searchClippings(store, { q: '"exploited actively"' }).total, 0);
  assert.equal(searchClippings(store, { theme: 'ai-offense' }).total, 1);
  assert.equal(searchClippings(store, { kind: 'authority' }).total, 1);
  assert.equal(searchClippings(store, { source: 'Outlet A' }).total, 2);
  // An empty query returns everything rather than nothing.
  assert.equal(searchClippings(store, { q: '' }).total, 3);
});

test('search paginates without losing the total', () => {
  const store = fakeSearchStore();
  const page = searchClippings(store, { q: '', limit: 2, offset: 0 });
  assert.equal(page.total, 3);
  assert.equal(page.results.length, 2);
  const next = searchClippings(store, { q: '', limit: 2, offset: 2 });
  assert.equal(next.results.length, 1);
  assert.notEqual(page.results[0].id, next.results[0].id);
});

test('search filters by date range', () => {
  const store = fakeSearchStore();
  assert.equal(searchClippings(store, { from: '2026-09-19T00:00:00.000Z' }).total, 1);
  assert.equal(searchClippings(store, { to: '2026-09-18T00:00:00.000Z' }).total, 1);
});

/* ---- Skills across the archive ---------------------------------------- */

test('skill demand is derived from theme history and ranked by durability', () => {
  const themes = [
    { id: 'ransomware', skills: ['incident-response'] },
    { id: 'ai-offense', skills: ['ai-security'] },
  ];
  const skills = {
    'incident-response': { label: 'Incident response', demandDriver: 'd', practice: 'p' },
    'ai-security': { label: 'AI security', demandDriver: 'd', practice: 'p' },
  };
  const trends = {
    editions: [
      { id: 'e1', createdAt: '2026-09-18T00:00:00.000Z', themes: { ransomware: { share: 20 }, 'ai-offense': { share: 1 } } },
      { id: 'e2', createdAt: '2026-09-18T12:00:00.000Z', themes: { ransomware: { share: 21 }, 'ai-offense': { share: 1 } } },
      { id: 'e3', createdAt: '2026-09-19T00:00:00.000Z', themes: { ransomware: { share: 20 }, 'ai-offense': { share: 14 } } },
      { id: 'e4', createdAt: '2026-09-19T12:00:00.000Z', themes: { ransomware: { share: 21 }, 'ai-offense': { share: 16 } } },
    ],
    entities: { cves: {}, actors: {} },
  };

  const result = skillTrends(trends, themes, skills);
  assert.equal(result.editions, 4);

  const ir = result.skills.find((s) => s.id === 'incident-response');
  const ai = result.skills.find((s) => s.id === 'ai-security');
  assert.equal(ir.status, 'sustained', `steady demand should be sustained, got ${ir.status}`);
  assert.equal(ai.status, 'rising', `sharp growth should be rising, got ${ai.status}`);
  // Durable demand outranks a newcomer even when the newcomer is loud today.
  assert.ok(result.skills.indexOf(ir) < result.skills.indexOf(ai));
  assert.equal(ir.presence, 100);
});

test('skill trends survive an empty archive', () => {
  const result = skillTrends({ editions: [], entities: { cves: {}, actors: {} } }, [], {});
  assert.deepEqual(result.skills, []);
  assert.equal(result.editions, 0);
});

/* ---- Weekly review ----------------------------------------------------- */

test('the weekly review separates what held from what emerged', () => {
  const now = Date.now();
  const at = (hoursAgo) => new Date(now - hoursAgo * 3600000).toISOString();
  const themes = [
    { id: 'ransomware', label: 'Ransomware & Extortion' },
    { id: 'ai-offense', label: 'AI-Enabled Offense' },
    { id: 'ot-ics', label: 'OT, ICS & Critical Infrastructure' },
  ];
  const trends = {
    editions: [
      { id: 'e1', createdAt: at(96), storyCount: 60, themes: { ransomware: { share: 12 }, 'ot-ics': { share: 6 } } },
      { id: 'e2', createdAt: at(72), storyCount: 60, themes: { ransomware: { share: 11 }, 'ot-ics': { share: 5 } } },
      { id: 'e3', createdAt: at(24), storyCount: 60, themes: { ransomware: { share: 13 }, 'ai-offense': { share: 9 } } },
      { id: 'e4', createdAt: at(2), storyCount: 60, themes: { ransomware: { share: 12 }, 'ai-offense': { share: 11 } } },
    ],
    entities: {
      cves: {},
      actors: {
        akira: { key: 'akira', label: 'Akira', first: at(96), last: at(2), mentions: 7, editions: ['e1', 'e3', 'e4'], stories: [{ title: 'x', url: 'https://a.example/1' }] },
        oneoff: { key: 'oneoff', label: 'OneOff', first: at(96), last: at(96), mentions: 1, editions: ['e1'], stories: [] },
      },
    },
  };
  const store = { clippings: [{ i: '1', t: 'A story', u: 'https://a.example/s', s: 'Outlet', k: 'journalism', d: at(3), e: 'e4', h: [], x: '' }] };

  const week = weeklyReview(trends, store, themes, 7);
  assert.equal(week.ready, true);
  assert.equal(week.editions, 4);
  assert.equal(week.storiesPublished, 240);

  assert.ok(week.persisted.some((t) => t.id === 'ransomware'), 'ransomware ran all week');
  assert.ok(week.emerged.some((t) => t.id === 'ai-offense'), 'AI offense appeared only in the second half');
  assert.ok(week.faded.some((t) => t.id === 'ot-ics'), 'OT went quiet');

  // A name seen in one edition is not "recurring".
  assert.ok(week.actors.some((a) => a.label === 'Akira'));
  assert.ok(!week.actors.some((a) => a.label === 'OneOff'));
});

test('the weekly review declines to render without enough editions', () => {
  const week = weeklyReview({ editions: [], entities: { cves: {}, actors: {} } }, { clippings: [] }, [], 7);
  assert.equal(week.ready, false);
});

/* ---- Reader profile ---------------------------------------------------- */

test('the public profile view scopes new and read to the current edition', () => {
  const edition = { stories: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  const profile = {
    lastVisitAt: '2026-09-25T00:00:00.000Z',
    lastSeenEdition: 'e1',
    // 'z' belongs to an older edition and must not leak into the counts.
    newIds: ['a', 'b', 'z'],
    read: { b: Date.now(), z: Date.now() },
    seen: {},
    watch: { cves: [], actors: [], topics: [], sources: [] },
  };

  const view = publicView(profile, edition);
  assert.deepEqual(view.newIds, ['a', 'b']);
  assert.equal(view.newCount, 2);
  assert.deepEqual(view.readIds, ['b']);
  assert.equal(view.readCount, 1);
});

test('watch activity reports only what the reader follows, new first', () => {
  const edition = {
    stories: [
      { id: 'a', title: 'Akira hits a hospital', summary: 'Ransomware.', url: 'https://a.example/1', sourceName: 'A', themes: [{ id: 'ransomware', label: 'Ransomware & Extortion' }] },
      { id: 'b', title: 'Unrelated patch notes', summary: 'Nothing here.', url: 'https://a.example/2', sourceName: 'B', themes: [{ id: 'ot-ics', label: 'OT' }] },
      { id: 'c', title: 'CVE-2026-1234 exploited', summary: 'Active exploitation.', url: 'https://a.example/3', sourceName: 'C', themes: [] },
    ],
  };
  const profile = {
    newIds: ['a'],
    watch: { cves: ['CVE-2026-1234'], actors: ['Akira'], topics: ['ransomware'], sources: [] },
  };

  const activity = watchActivity(profile, edition);
  const labels = activity.map((a) => a.label);
  assert.ok(labels.includes('Akira'));
  assert.ok(labels.includes('CVE-2026-1234'));
  assert.ok(labels.includes('Ransomware & Extortion'));
  // Nothing the reader does not follow appears.
  assert.ok(!labels.includes('OT'));
  // Entries with new activity sort ahead of quiet ones.
  assert.equal(activity[0].new, 1);
});

test('a reader following nothing sees nothing', () => {
  const edition = { stories: [{ id: 'a', title: 'x', summary: 'y', url: 'https://a.example/1', sourceName: 'A', themes: [] }] };
  const profile = { newIds: [], watch: { cves: [], actors: [], topics: [], sources: [] } };
  assert.deepEqual(watchActivity(profile, edition), []);
});

/* ---- Syndication ------------------------------------------------------ */

const fakeEdition = () => ({
  id: '2026-09-20T0600Z',
  createdAt: '2026-09-20T06:00:00.000Z',
  windowHours: 12,
  stories: [
    {
      id: 'a', title: 'Zero-day <exploited> & "quoted"', url: 'https://a.example/x', summary: 'A summary of the event.',
      sourceName: 'Outlet A', sourceKind: 'journalism', publishedAt: '2026-09-20T05:00:00.000Z',
      signals: ['Active exploitation'], themes: [{ id: 'exploited-edge', label: 'Actively Exploited Edge & Perimeter' }],
      alsoReportedBy: [{ sourceName: 'Outlet B', url: 'https://b.example/x', title: 'Same story' }],
    },
    {
      id: 'b', title: 'Routine advisory', url: 'https://a.example/y', summary: 'Nothing urgent here.',
      sourceName: 'Outlet C', sourceKind: 'authority', publishedAt: '2026-09-20T04:00:00.000Z',
      signals: [], themes: [], alsoReportedBy: [],
    },
  ],
  insights: { outlook: { lede: 'The lede.' } },
  meta: { sourcesOk: 100 },
});

test('RSS output is well formed and escapes feed content', () => {
  const xml = renderRss(fakeEdition(), { siteUrl: 'http://example.test' });
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<rss version="2.0"'));
  assert.equal((xml.match(/<item>/g) || []).length, 2);
  // Raw angle brackets from a headline must not escape into markup.
  assert.ok(xml.includes('Zero-day &lt;exploited&gt; &amp; &quot;quoted&quot;'));
  assert.ok(!/<title>[^<]*<exploited>/.test(xml));
  // Items link to the publisher, not back to this site.
  assert.ok(xml.includes('<link>https://a.example/x</link>'));
  // Tags balance.
  assert.equal((xml.match(/<item>/g) || []).length, (xml.match(/<\/item>/g) || []).length);
});

test('RSS can be filtered to one theme', () => {
  const xml = renderRss(fakeEdition(), { siteUrl: 'http://example.test', themeFilter: 'exploited-edge' });
  assert.equal((xml.match(/<item>/g) || []).length, 1);
  assert.ok(xml.includes('https://a.example/x'));
  assert.ok(!xml.includes('https://a.example/y'));
});

test('text digest lists stories with their links', () => {
  const text = renderDigestText(fakeEdition(), { siteUrl: 'http://example.test' });
  assert.ok(text.includes('2026-09-20T0600Z'));
  assert.ok(text.includes('https://a.example/x'));
  assert.ok(text.includes('The lede.'));
});

test('only high-urgency stories trigger alerts', () => {
  const urgent = urgentStories(fakeEdition());
  assert.equal(urgent.length, 1);
  assert.equal(urgent[0].id, 'a');
});

/* ---- Refresh safety floor --------------------------------------------- */

test('an abandoned refresh is a distinct, inspectable error', () => {
  const err = new RefreshAbandoned('nothing reachable', { sourcesOk: 1, sourcesTotal: 113, published: 0 });
  assert.ok(err instanceof Error);
  assert.ok(err instanceof RefreshAbandoned);
  assert.equal(err.name, 'RefreshAbandoned');
  assert.equal(err.detail.published, 0);
  // The scheduler distinguishes this from an unexpected crash, so the
  // instanceof check it relies on has to hold.
  assert.equal(new Error('boom') instanceof RefreshAbandoned, false);
});

test('the safety floor rejects a cycle that reached almost nothing', () => {
  const floor = config.minSourcesOkRatio;
  const shouldPublish = (ok, total, published) => ok / total >= floor && published > 0;

  // The real failure: asleep or offline, one source answered, nothing survived.
  assert.equal(shouldPublish(1, 113, 0), false);
  // A partial outage that still produced a full page is fine to publish.
  assert.equal(shouldPublish(107, 113, 60), true);
  // Sources answered but nothing survived the window - still not publishable.
  assert.equal(shouldPublish(113, 113, 0), false);
  assert.ok(floor > 0 && floor < 1, `floor should be a ratio, got ${floor}`);
});

/* ---- QR encoder -------------------------------------------------------- */

test('Reed-Solomon matches the QR specification worked example', () => {
  // ISO/IEC 18004 Annex I: version 1-M, numeric "01234567".
  const data = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
  const expected = [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55];
  assert.deepEqual(ecCodewords(data, 10), expected);
});

test('QR symbols carry the required function patterns', () => {
  // Scannability itself was verified in-browser against the native
  // BarcodeDetector; these are the invariants that break silently.
  for (const text of ['http://host.local:4173', 'https://example.com/test', 'SENTINEL FEED 12345']) {
    const { size, modules, version } = encodeQr(text);
    assert.equal(size, version * 4 + 17, 'size must follow the version');

    const finder = (r0, c0) => {
      for (let r = 0; r < 7; r += 1) {
        for (let c = 0; c < 7; c += 1) {
          const edge = r === 0 || r === 6 || c === 0 || c === 6;
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          assert.equal(modules[r0 + r][c0 + c], edge || core ? 1 : 0, `finder at ${r0},${c0}`);
        }
      }
    };
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    // The always-dark module must survive format-information placement.
    assert.equal(modules[size - 8][8], 1, 'dark module');

    for (let i = 8; i < size - 8; i += 1) {
      const expected = i % 2 === 0 ? 1 : 0;
      assert.equal(modules[6][i], expected, 'horizontal timing');
      assert.equal(modules[i][6], expected, 'vertical timing');
    }

    // No module may be left unwritten.
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) assert.notEqual(modules[r][c], null, `unset module ${r},${c}`);
    }
  }
});

test('QR version grows with content and refuses the impossible', () => {
  assert.ok(encodeQr('short').version <= encodeQr('x'.repeat(200)).version);
  assert.throws(() => encodeQr('x'.repeat(5000)), /too long/);
});

test('QR SVG includes the quiet zone scanners need', () => {
  const svg = qrSvg('https://example.com/test', { scale: 4, quiet: 4 });
  const { size } = encodeQr('https://example.com/test');
  const expected = (size + 8) * 4;
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes(`width="${expected}"`), `expected width ${expected}`);
  assert.ok(svg.includes('</svg>'));
});

/* ---- Glossary ---------------------------------------------------------- */

test('every glossary entry has a usable plain-English definition', () => {
  assert.ok(GLOSSARY.length >= 100, `expected a substantial glossary, got ${GLOSSARY.length}`);
  for (const item of GLOSSARY) {
    assert.ok(item.term && item.term.length > 1, 'term must be present');
    assert.ok(item.short && item.short.length >= 40, `${item.term}: definition too short to explain anything`);
    assert.ok(item.short.length <= 320, `${item.term}: definition too long for a popover`);
    assert.ok(/[.!?]$/.test(item.short.trim()), `${item.term}: definition should be a sentence`);
    // A definition that opens by restating the term explains nothing.
    assert.ok(
      !item.short.toLowerCase().startsWith(`${item.term.toLowerCase()} is`),
      `${item.term}: definition restates the term`,
    );
  }
});

test('no two glossary entries claim the same form', () => {
  const owner = new Map();
  for (const item of GLOSSARY) {
    for (const form of [item.term, ...(item.aliases || [])]) {
      const key = form.toLowerCase();
      assert.ok(
        !owner.has(key) || owner.get(key) === item.term,
        `"${form}" is claimed by both ${owner.get(key)} and ${item.term}`,
      );
      owner.set(key, item.term);
    }
  }
});

test('the matcher tries the longest form first', () => {
  const index = glossaryIndex();
  for (let i = 1; i < index.length; i += 1) {
    assert.ok(index[i - 1].form.length >= index[i].form.length, 'index must be sorted longest-first');
  }
  // The specific collision this ordering exists to resolve.
  const rce = index.findIndex((e) => e.form === 'remote code execution');
  const cve = index.findIndex((e) => e.form === 'CVE');
  assert.ok(rce < cve, 'the long phrase must be matched before the short acronym');
});

test('the glossary covers the vocabulary this corpus actually uses', () => {
  // Terms drawn from real headlines in the archive.
  const mustCover = [
    'zero-day', 'RCE', 'CVE', 'CVSS', 'ransomware', 'phishing', 'exploit',
    'patch', 'credential', 'MFA', 'supply chain attack', 'threat actor',
    'privilege escalation', 'buffer overflow', 'firewall', 'VPN', 'botnet',
    'backdoor', 'prompt injection', 'APT', 'KEV', 'exfiltration',
  ];
  const forms = new Set(glossaryIndex().map((e) => e.form.toLowerCase()));
  const missing = mustCover.filter((t) => !forms.has(t.toLowerCase()));
  assert.deepEqual(missing, [], `glossary is missing: ${missing.join(', ')}`);
});

test('definitions avoid defining jargon with more jargon', () => {
  // A definition may mention another term, but the worst offenders - acronyms
  // with no expansion - should not appear unexplained in a beginner's first read.
  const opaque = ['TTP', 'IOC', 'C2', 'LOLBin', 'RaaS', 'IdP', 'AiTM'];
  for (const item of GLOSSARY) {
    for (const acronym of opaque) {
      if (item.term === acronym || (item.aliases || []).includes(acronym)) continue;
      assert.ok(
        !new RegExp(`\\b${acronym}\\b`).test(item.short),
        `${item.term}: definition uses "${acronym}" without explaining it`,
      );
    }
  }
});

/* ---- Network ----------------------------------------------------------- */

test('tailnet addresses are recognised by their shared range', () => {
  // Tailscale assigns from 100.64.0.0/10: 100.64.0.0 through 100.127.255.255.
  assert.equal(isTailnetIPv4('100.100.42.7'), true);
  assert.equal(isTailnetIPv4('100.64.0.1'), true);
  assert.equal(isTailnetIPv4('100.127.255.254'), true);
  // Just outside the range on either side.
  assert.equal(isTailnetIPv4('100.63.255.255'), false);
  assert.equal(isTailnetIPv4('100.128.0.1'), false);
  // Ordinary private LAN addresses.
  assert.equal(isTailnetIPv4('10.0.0.25'), false);
  assert.equal(isTailnetIPv4('192.168.1.40'), false);
  assert.equal(isTailnetIPv4(''), false);
});

/* ---- Security --------------------------------------------------------- */

test('rate limiter allows a burst then refuses', () => {
  const limiter = new RateLimiter();
  for (let i = 0; i < 3; i += 1) {
    assert.equal(limiter.take('k', 3, 60000).allowed, true, `call ${i} should be allowed`);
  }
  const blocked = limiter.take('k', 3, 60000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0);
  // A different client has its own budget.
  assert.equal(limiter.take('other', 3, 60000).allowed, true);
});

test('rate limiter resets after the window', () => {
  const limiter = new RateLimiter();
  assert.equal(limiter.take('k', 1, 1).allowed, true);
  const after = Date.now() + 5;
  while (Date.now() < after) { /* brief spin, the window is 1ms */ }
  assert.equal(limiter.take('k', 1, 1).allowed, true);
});

test('loopback addresses are recognised in both families', () => {
  assert.equal(isLoopback('127.0.0.1'), true);
  assert.equal(isLoopback('::1'), true);
  assert.equal(isLoopback('::ffff:127.0.0.1'), true);
  assert.equal(isLoopback('192.168.1.40'), false);
  assert.equal(isLoopback(''), false);
});

test('token is read from header, custom header or query', () => {
  const url = new URL('http://x/api/refresh?token=fromquery');
  assert.equal(presentedToken({ headers: { authorization: 'Bearer abc' } }, url), 'abc');
  assert.equal(presentedToken({ headers: { 'x-sentinel-token': 'def' } }, url), 'def');
  assert.equal(presentedToken({ headers: {} }, url), 'fromquery');
  assert.equal(presentedToken({ headers: {} }, new URL('http://x/api/refresh')), '');
});

/* ---- Files ------------------------------------------------------------ */

{
  // Async, so it runs outside test(); the result is reported the same way.
  const name = 'atomic writes replace files and leave no temp file behind';
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sentinel-'));
  try {
    const file = path.join(dir, 'x.json');
    await writeJsonAtomic(file, { v: 1 });
    await writeJsonAtomic(file, { v: 2 }, { pretty: true });
    assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { v: 2 });

    // A failure that is not a transient lock must surface, and clean up.
    const blocked = path.join(dir, 'blocked');
    await fs.mkdir(path.join(blocked, 'inner'), { recursive: true });
    await assert.rejects(writeJsonAtomic(blocked, { v: 3 }));
    assert.deepEqual((await fs.readdir(dir)).sort(), ['blocked', 'x.json']);
    passed += 1;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ${err.message}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
