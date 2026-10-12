import { THEMES, SKILLS } from './taxonomy.js';

const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

/**
 * Convergences: observations that only hold when two patterns are both strong
 * in the same edition. These are the closest the engine comes to an opinion,
 * and they still require both themes to be independently evidenced.
 */
const CONVERGENCES = [
  {
    when: ['ai-offense', 'identity'],
    text: 'AI-assisted social engineering and identity abuse are showing up together, which points at a near future where the hard problem is proving a human or an agent is who it claims to be at the moment of the request.',
  },
  {
    when: ['ai-offense', 'endpoint-mobile'],
    text: 'Attacks on AI features inside browsers suggest the endpoint battleground is moving into the assistant layer, where untrusted page content and user authority meet in the same session.',
  },
  {
    when: ['supply-chain', 'ai-defense'],
    text: 'Supply chain compromise alongside AI adoption is a compounding risk: machine-generated code pulls in dependencies faster than review can keep up, so provenance checks have to be automatic rather than advisory.',
  },
  {
    when: ['exploited-edge', 'ransomware'],
    text: 'Edge exploitation feeding extortion remains the dominant intrusion pipeline, which makes time-to-patch on internet-facing systems a direct input into your ransomware risk.',
  },
  {
    when: ['nation-state', 'ot-ics'],
    text: 'State-linked activity against infrastructure indicates continued pre-positioning rather than immediate disruption, so the defensive question is detection of quiet residency, not incident volume.',
  },
  {
    when: ['regulation', 'data-breach'],
    text: 'Breach reporting arriving next to regulatory action shows accountability tightening around disclosure quality, making the evidence trail part of the security deliverable.',
  },
  {
    when: ['cloud-saas', 'identity'],
    text: 'SaaS incidents driven by tokens and connected apps confirm that the practical perimeter is the set of integrations holding live credentials into your data.',
  },
  {
    when: ['workforce', 'detection-ops'],
    text: 'Operational pressure reported alongside staffing strain reinforces the shift toward leverage: teams are expected to build automation rather than add analysts.',
  },
  {
    when: ['vuln-research', 'ai-defense'],
    text: 'Research output rising while AI enters the toolchain suggests finding bugs is getting cheaper faster than fixing them, so triage capacity and structural fixes become the bottleneck.',
  },
  {
    when: ['crypto-pqc', 'regulation'],
    text: 'Cryptographic deadlines arriving with regulatory weight turn crypto-agility into a programme with dates attached rather than an architectural preference.',
  },
];

const pct = (value) => Math.round(value * 1000) / 10;

function headlineRefs(items, limit = 3) {
  return items.slice(0, limit).map((item) => ({
    title: item.title,
    url: item.url,
    source: item.sourceName,
  }));
}

/**
 * Hands out evidence so the page cites the breadth of an edition rather than
 * its two biggest stories. The strongest stories match almost every theme, so
 * picking "the top-scored matches" for each section cites the same pair over
 * and over. Here a story is used once before any story is used twice, never
 * more than twice, and a theme prefers stories it is the primary theme of.
 */
function createEvidencePicker() {
  const uses = new Map();
  return function pick(candidates, limit, primaryIds = null) {
    const isPrimary = (item) => (primaryIds && primaryIds.has(item.themes?.[0]?.id) ? 1 : 0);
    const ranked = [...candidates].sort((a, b) => isPrimary(b) - isPrimary(a) || b.score - a.score);
    const chosen = [];
    for (const allowedUses of [0, 1]) {
      for (const item of ranked) {
        if (chosen.length >= limit) break;
        if (chosen.includes(item) || (uses.get(item.url) || 0) > allowedUses) continue;
        chosen.push(item);
      }
    }
    for (const item of chosen) uses.set(item.url, (uses.get(item.url) || 0) + 1);
    return headlineRefs(chosen, limit);
  };
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "A", "A and B", "A, B and C" */
function listOf(parts) {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** How each urgency signal reads inside a sentence, with its count. */
const SIGNAL_PHRASES = {
  'Active exploitation': (n) => `${plural(n, 'story', 'stories')} ${n === 1 ? 'reports' : 'report'} active exploitation`,
  'Zero-day': (n) => plural(n, 'zero-day'),
  'CISA KEV': (n) => `${plural(n, 'flaw')} ${n === 1 ? 'was' : 'were'} added to CISA's exploited list`,
  'Emergency patch': (n) => `${plural(n, 'emergency patch', 'emergency patches')}`,
  'Critical severity': (n) => `${plural(n, 'critical-severity flaw')}`,
  'Unauthenticated RCE': (n) => `${plural(n, 'flaw')} ${n === 1 ? 'allows' : 'allow'} remote code execution`,
  'Large-scale data loss': (n) => `${plural(n, 'large-scale data loss', 'large-scale data losses')}`,
  Extortion: (n) => `${plural(n, 'story', 'stories')} ${n === 1 ? 'covers' : 'cover'} ransomware or extortion`,
  'State-linked': (n) => `${plural(n, 'state-linked operation')}`,
  'Supply chain': (n) => `${plural(n, 'supply-chain compromise')}`,
  'No fix available': (n) => `${n} with no fix yet`,
};

/** Signals that, when present, say the edition is urgent. */
const URGENT = new Set(['Active exploitation', 'Zero-day', 'CISA KEV', 'Emergency patch']);

const KIND_LABEL = {
  journalism: 'journalism',
  authority: 'government and vendor advisories',
  research: 'original research',
  practitioner: 'practitioner writing',
};

/**
 * The overall view: what the whole corpus looks like, not just its top
 * themes - how broad it is, how urgent, who is reporting it, what is named
 * in it, and what moved since the last edition.
 */
function buildOverview({ items, themes, sourceCount, windowHours, entityTotals, hasPrevious, pick }) {
  const stories = items.length;

  // Breadth: how many tracked themes appear, and how much the top three carry.
  const top3Share = Math.round(themes.slice(0, 3).reduce((sum, t) => sum + t.share, 0));
  const breadthLabel = top3Share >= 55 ? 'concentrated' : top3Share <= 35 ? 'broad' : 'mixed';

  // Who is reporting.
  const kindCounts = new Map();
  for (const item of items) {
    const kind = item.sourceKind || 'journalism';
    kindCounts.set(kind, (kindCounts.get(kind) || 0) + 1);
  }
  const sourceMix = [...kindCounts.entries()]
    .map(([kind, count]) => ({ kind, count, share: stories ? Math.round((count / stories) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // How urgent.
  const signalCounts = new Map();
  for (const item of items) {
    for (const signal of item.signals || []) signalCounts.set(signal, (signalCounts.get(signal) || 0) + 1);
  }
  const signals = [...signalCounts.entries()]
    .map(([label, count]) => ({ label, count, urgent: URGENT.has(label) }))
    .sort((a, b) => b.count - a.count);
  const urgentStories = items.filter((item) => (item.signals || []).some((sig) => URGENT.has(sig))).length;

  // What moved since the last edition.
  const moved = (direction) =>
    themes
      .filter((t) => t.momentum?.direction === direction)
      .sort((a, b) => Math.abs(b.momentum.delta) - Math.abs(a.momentum.delta))
      .slice(0, 3)
      .map((t) => ({ label: t.label, delta: t.momentum.delta }));
  const changes = hasPrevious ? { rising: moved('up'), cooling: moved('down') } : { rising: [], cooling: [] };

  // The landscape: every active theme, each with examples of its own.
  const landscape = themes.map((theme) => ({
    id: theme.id,
    label: theme.label,
    count: theme.count,
    share: theme.share,
    examples: pick(theme.matched, 2, new Set([theme.id])),
  }));

  // ---- the summary, in sentences ----
  const sentences = [];
  sentences.push(
    `This edition reads ${plural(stories, 'story', 'stories')} from ${plural(sourceCount, 'source')} published in the last ${windowHours} hours.`,
  );

  if (themes.length) {
    const leaders = listOf(themes.slice(0, 3).map((t) => t.label));
    sentences.push(
      breadthLabel === 'concentrated'
        ? `Coverage is concentrated: ${leaders} carry ${top3Share}% of the weighted signal between them.`
        : breadthLabel === 'broad'
          ? `Coverage is broad: ${themes.length} of the tracked themes appear, and even the three largest - ${leaders} - carry only ${top3Share}% of the signal.`
          : `Coverage is spread across ${themes.length} themes, led by ${leaders} with ${top3Share}% of the signal between them.`,
    );
  }

  // Urgent signals lead, then the most common of the rest.
  const phrased = [...signals]
    .filter((sig) => SIGNAL_PHRASES[sig.label])
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.count - a.count)
    .slice(0, 3)
    .map((sig) => SIGNAL_PHRASES[sig.label](sig.count));
  if (phrased.length) {
    const urgency =
      urgentStories >= Math.max(3, stories * 0.08)
        ? 'Urgency is high'
        : urgentStories > 0
          ? 'There is real urgency in places'
          : 'Little of it is urgent';
    sentences.push(`${urgency}: ${listOf(phrased)}.`);
  }

  if (sourceMix.length) {
    const [first, ...rest] = sourceMix;
    const others = rest.filter((m) => m.share >= 5).map((m) => `${m.share}% ${KIND_LABEL[m.kind] || m.kind}`);
    sentences.push(
      `Most of it is ${KIND_LABEL[first.kind] || first.kind} (${first.share}%)${others.length ? `, with ${listOf(others)}` : ''}.`,
    );
  }

  if (entityTotals.cves || entityTotals.actors) {
    const named = [];
    if (entityTotals.cves) named.push(plural(entityTotals.cves, 'distinct CVE'));
    if (entityTotals.actors) named.push(plural(entityTotals.actors, 'named threat group'));
    const cited = [entityTotals.topCve, entityTotals.topActor].filter(Boolean);
    sentences.push(
      `${listOf(named)} ${entityTotals.cves + entityTotals.actors === 1 ? 'appears' : 'appear'}${cited.length ? `; the most cited ${cited.length === 1 ? 'is' : 'are'} ${listOf(cited)}` : ''}.`,
    );
  }

  if (changes.rising.length || changes.cooling.length) {
    const fmt = (list) => listOf(list.map((t) => t.label));
    const parts = [];
    if (changes.rising.length) parts.push(`${fmt(changes.rising)} ${changes.rising.length === 1 ? 'is' : 'are'} rising`);
    if (changes.cooling.length) parts.push(`${fmt(changes.cooling)} ${changes.cooling.length === 1 ? 'is' : 'are'} cooling`);
    sentences.push(`Since the last edition, ${parts.join(', while ')}.`);
  }

  return {
    summary: sentences.join(' '),
    sentences,
    stories,
    sources: sourceCount,
    windowHours,
    breadth: { label: breadthLabel, matched: themes.length, tracked: THEMES.length, top3Share },
    urgentStories,
    signals,
    sourceMix,
    entities: entityTotals,
    changes,
    landscape,
  };
}

/**
 * Groups that are routinely written more than one way. Counting "Clop" and
 * "Cl0p" as two actors would overstate both.
 */
const ACTOR_ALIASES = new Map([
  ['cl0p', 'Clop'],
  ['blackcat', 'ALPHV/BlackCat'],
  ['alphv', 'ALPHV/BlackCat'],
  ['play ransomware', 'Play'],
]);

/** Extract the concrete identifiers analysts tend to track across a cycle. */
function extractEntities(items) {
  const cves = new Map();
  const actors = new Map();
  // "Play" only counts when qualified, or it would match "Google Play".
  const ACTOR_PATTERN =
    /\b(APT\d{1,3}|Lazarus|Kimsuky|Sandworm|Salt Typhoon|Volt Typhoon|Silk Typhoon|Midnight Blizzard|Scattered Spider|LockBit|ALPHV|BlackCat|Cl0p|Clop|Akira|Rhysida|Qilin|Medusa|BlackSuit|Hunters International|Play ransomware|Turla|Mustang Panda|Charming Kitten|FIN\d{1,2}|UNC\d{3,5}|TA\d{3,4}|Settra)\b/g;

  for (const item of items) {
    const text = `${item.title} ${item.summary || ''}`;
    for (const match of text.matchAll(/\bCVE-\d{4}-\d{4,7}\b/gi)) {
      const id = match[0].toUpperCase();
      if (!cves.has(id)) cves.set(id, { id, count: 0, items: [] });
      const entry = cves.get(id);
      entry.count += 1;
      if (entry.items.length < 3 && !entry.items.some((i) => i.url === item.url)) {
        entry.items.push({ title: item.title, url: item.url, source: item.sourceName });
      }
    }
    for (const match of text.matchAll(ACTOR_PATTERN)) {
      const raw = match[0];
      const name = ACTOR_ALIASES.get(raw.toLowerCase()) || raw;
      const key = name.toLowerCase();
      if (!actors.has(key)) actors.set(key, { name, count: 0, items: [] });
      const entry = actors.get(key);
      entry.count += 1;
      if (entry.items.length < 3 && !entry.items.some((i) => i.url === item.url)) {
        entry.items.push({ title: item.title, url: item.url, source: item.sourceName });
      }
    }
  }

  const rank = (map) => [...map.values()].sort((a, b) => b.count - a.count);
  const rankedCves = rank(cves);
  const rankedActors = rank(actors);
  return {
    cves: rankedCves.slice(0, 8),
    actors: rankedActors.slice(0, 8),
    totals: {
      cves: cves.size,
      actors: actors.size,
      topCve: rankedCves[0] && rankedCves[0].count > 1 ? `${rankedCves[0].id} (${plural(rankedCves[0].count, 'story', 'stories')})` : null,
      topActor: rankedActors[0] && rankedActors[0].count > 1 ? `${rankedActors[0].name} (${plural(rankedActors[0].count, 'story', 'stories')})` : null,
    },
  };
}

/**
 * Derive the whole insight panel from the edition's stories.
 *
 * `previousShares` is a map of themeId -> share from the previous edition and
 * drives the momentum arrows; omit it for the first edition.
 */
export function buildInsights(items, { previousShares = {}, windowHours = 12, sourceCount = 0 } = {}) {
  const scored = [];
  for (const theme of THEMES) {
    const matched = items
      .filter((item) => (item.themes || []).some((t) => t.id === theme.id))
      .sort((a, b) => b.score - a.score);
    if (!matched.length) continue;

    // Score blends how many stories matched with how prominent those stories
    // are, so one major story counts for more than several minor mentions.
    const prominence = matched.reduce((sum, item) => sum + item.score, 0);
    scored.push({
      id: theme.id,
      label: theme.label,
      count: matched.length,
      prominence: Number(prominence.toFixed(2)),
      weightedScore: Number((prominence * theme.weight).toFixed(2)),
      implication: theme.implication,
      horizon: theme.horizon,
      mindset: theme.mindset,
      skills: theme.skills,
      headlines: headlineRefs(matched, 3),
      matched,
    });
  }

  const totalWeighted = scored.reduce((sum, t) => sum + t.weightedScore, 0) || 1;
  const totalMatches = scored.reduce((sum, t) => sum + t.count, 0) || 1;

  const themes = scored
    .map((theme) => {
      const share = theme.weightedScore / totalWeighted;
      const previous = previousShares[theme.id];
      const delta = typeof previous === 'number' ? pct(share) - pct(previous) : null;
      return {
        ...theme,
        share: pct(share),
        coverage: pct(theme.count / totalMatches),
        momentum:
          delta === null
            ? { delta: null, direction: 'new' }
            : { delta: Number(delta.toFixed(1)), direction: delta > 1.5 ? 'up' : delta < -1.5 ? 'down' : 'flat' },
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);

  const top = themes.slice(0, 4);
  const strongIds = new Set(themes.slice(0, 8).filter((t) => t.count >= 2).map((t) => t.id));

  // Evidence is allocated in page order, so the overview's landscape gets
  // first claim on each theme's own stories and later sections draw on the
  // rest of the edition instead of repeating them.
  const pick = createEvidencePicker();
  const entities = extractEntities(items);
  const overview = buildOverview({
    items,
    themes,
    sourceCount,
    windowHours,
    entityTotals: entities.totals,
    hasPrevious: Object.keys(previousShares).length > 0,
    pick,
  });

  const convergences = CONVERGENCES.filter((c) => c.when.every((id) => strongIds.has(id)))
    .slice(0, 3)
    .map((c) => ({
      text: c.text,
      themes: c.when.map((id) => THEME_BY_ID.get(id)?.label).filter(Boolean),
      // A convergence is about stories carrying both themes at once.
      headlines: pick(
        items.filter((item) => c.when.every((id) => (item.themes || []).some((t) => t.id === id))).length
          ? items.filter((item) => c.when.every((id) => (item.themes || []).some((t) => t.id === id)))
          : items.filter((item) => c.when.some((id) => (item.themes || []).some((t) => t.id === id))),
        2,
        new Set(c.when),
      ),
    }));

  // ---- Outlook narrative -------------------------------------------------
  const lede = top.length ? overview.summary : `No themed signal was detected in the last ${windowHours} hours.`;

  const outlook = {
    lede,
    reading: top.map((theme) => ({
      label: theme.label,
      text: theme.implication,
      share: theme.share,
      count: theme.count,
      headlines: pick(theme.matched, 2, new Set([theme.id])),
    })),
    horizon: top.slice(0, 3).map((theme) => ({ label: theme.label, text: theme.horizon })),
    convergences,
  };

  // ---- Skills in demand --------------------------------------------------
  const skillScores = new Map();
  themes.forEach((theme, index) => {
    // Themes lower down the ranking contribute proportionally less demand.
    const positional = 1 / (1 + index * 0.35);
    theme.skills.forEach((skillId, skillIndex) => {
      const definition = SKILLS[skillId];
      if (!definition) return;
      const contribution = theme.weightedScore * positional * (1 - skillIndex * 0.12);
      const entry = skillScores.get(skillId) || {
        id: skillId,
        label: definition.label,
        demandDriver: definition.demandDriver,
        practice: definition.practice,
        score: 0,
        drivenBy: [],
      };
      entry.score += contribution;
      entry.drivenBy.push({ label: theme.label, share: theme.share, id: theme.id });
      skillScores.set(skillId, entry);
    });
  });

  const maxSkillScore = Math.max(...[...skillScores.values()].map((s) => s.score), 1);
  const skills = [...skillScores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 9)
    .map((skill) => {
      const drivers = skill.drivenBy.sort((a, b) => b.share - a.share).slice(0, 3);
      const driverIds = new Set(drivers.map((d) => d.id));
      return {
        id: skill.id,
        label: skill.label,
        demandDriver: skill.demandDriver,
        practice: skill.practice,
        intensity: Math.round((skill.score / maxSkillScore) * 100),
        drivenBy: drivers.map((d) => d.label),
        headlines: pick(
          items.filter((item) => (item.themes || []).some((t) => driverIds.has(t.id))),
          2,
          driverIds,
        ),
      };
    });

  // ---- Prevailing thinking ----------------------------------------------
  const mindsets = themes.slice(0, 5).map((theme) => ({
    theme: theme.label,
    themeId: theme.id,
    text: theme.mindset,
    share: theme.share,
    headlines: pick(theme.matched, 2, new Set([theme.id])),
  }));

  return {
    // The matched story lists were working state; editions keep the refs.
    themes: themes.map(({ matched, ...theme }) => theme),
    overview,
    outlook,
    skills,
    mindsets,
    entities: { cves: entities.cves, actors: entities.actors },
    method: {
      note:
        'Insights are derived mechanically from this edition\'s stories: each theme is matched by language patterns, weighted by how prominent the matching stories are, and every claim links the headlines that triggered it. Evidence is spread so that no story is cited twice before every relevant story has been cited once. Nothing here is a human forecast.',
      themesEvaluated: THEMES.length,
      themesMatched: themes.length,
    },
  };
}

/** Compact map of theme shares, persisted so the next edition can show momentum. */
export function shareSnapshot(insights) {
  const out = {};
  for (const theme of insights.themes) out[theme.id] = theme.share / 100;
  return out;
}
