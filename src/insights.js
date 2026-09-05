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

  const rank = (map) => [...map.values()].sort((a, b) => b.count - a.count || a.count - b.count);
  return {
    cves: rank(cves).slice(0, 8),
    actors: rank(actors).slice(0, 8),
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

  const convergences = CONVERGENCES.filter((c) => c.when.every((id) => strongIds.has(id)))
    .slice(0, 3)
    .map((c) => ({
      text: c.text,
      themes: c.when.map((id) => THEME_BY_ID.get(id)?.label).filter(Boolean),
      headlines: headlineRefs(
        items
          .filter((item) => c.when.some((id) => (item.themes || []).some((t) => t.id === id)))
          .sort((a, b) => b.score - a.score),
        2,
      ),
    }));

  // ---- Outlook narrative -------------------------------------------------
  const lede = top.length
    ? `Across ${items.length} stories drawn from ${sourceCount} sources in the last ${windowHours} hours, coverage concentrates on ${top[0].label} (${top[0].share}% of weighted signal)${
        top[1] ? `, with ${top[1].label}${top[2] ? ` and ${top[2].label}` : ''} close behind` : ''
      }.`
    : `No themed signal was detected in the last ${windowHours} hours.`;

  const outlook = {
    lede,
    reading: top.map((theme) => ({ label: theme.label, text: theme.implication, share: theme.share })),
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
        headlines: headlineRefs(
          items
            .filter((item) => (item.themes || []).some((t) => driverIds.has(t.id)))
            .sort((a, b) => b.score - a.score),
          2,
        ),
      };
    });

  // ---- Prevailing thinking ----------------------------------------------
  const mindsets = themes.slice(0, 5).map((theme) => ({
    theme: theme.label,
    themeId: theme.id,
    text: theme.mindset,
    share: theme.share,
    headlines: theme.headlines.slice(0, 2),
  }));

  return {
    themes,
    outlook,
    skills,
    mindsets,
    entities: extractEntities(items),
    method: {
      note:
        'Insights are derived mechanically from this edition\'s stories: each theme is matched by language patterns, weighted by how prominent the matching stories are, and every claim links the headlines that triggered it. Nothing here is a human forecast.',
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
