// Importance scoring: which story groups matter most, and which can never be dropped.
//
//   score = coverage breadth (strongest) + source weight + impact + newness
//
// Must-include rule: a group covered by 5+ major outlets (wires + major
// newsrooms), or flagged "breaking" by a wire service, is ALWAYS in the
// edition, whatever the story limit. Tune the numbers below freely.

import { type Cluster, overlap, storyTokens } from './dedupe.ts';
import { itemCategory } from './feeds.ts';
import { isMajorOutlet, outletInfo, type Trust } from './sources.ts';

export const MUST_INCLUDE_MAJOR_OUTLETS = 5;
/** Daytime updates only push a notification above this (or for a wire "breaking" flag). */
export const BREAKING_PUSH_MAJOR_OUTLETS = 7;

const TRUST_WEIGHT: Record<Trust, number> = { high: 1.5, medium: 1, low: 0.5 };

/** Each matching group adds its points to "impact" (capped at 6). */
const IMPACT_RULES: { label: string; points: number; re: RegExp }[] = [
  { label: 'markets moved', points: 1.5, re: /\b(stocks?|shares|dow|s&p|nasdaq|bonds?|yields?|treasur(y|ies)|oil|brent|bitcoin|crypto|dollar|rupee|yen|sell-?off|rally|plunge[sd]?|plummet|surge[sd]?|soar(s|ed)?|tumble[sd]?|slump|crash(es|ed)?)\b/i },
  { label: 'rates or economic data', points: 1.5, re: /\b(fed|federal reserve|central bank|interest rates?|rate (cut|hike)s?|inflation|cpi|jobs report|payrolls|unemployment|jobless|gdp|recession|tariffs?|rbi|ecb)\b/i },
  { label: 'governments or conflict', points: 1, re: /\b(president|prime minister|government|congress|senate|parliament|supreme court|regulators?|bans?|sanctions?|elections?|war|invasion|ceasefire|missiles?|airstrikes?|attack(s|ed)?|troops)\b/i },
  { label: 'many people affected', points: 1, re: /\b(earthquake|hurricane|typhoon|cyclone|floods?|wildfires?|killed|dead|dies|died|death toll|evacuat\w+|millions of|thousands of|nationwide|outage)\b/i },
  { label: 'major company', points: 0.5, re: /\b(apple|microsoft|google|alphabet|amazon|meta|nvidia|openai|anthropic|tesla|deepmind|samsung|tsmc|intel|amd|netflix|jpmorgan|berkshire|broadcom|oracle)\b/i },
  { label: 'deal, funding or layoffs', points: 0.5, re: /\b(acquires?|acquisition|merger|takeover|ipo|funding|raises?|valuation|layoffs?|job cuts|bankrupt(cy)?)\b/i },
  { label: 'security breach', points: 0.5, re: /\b(breach(ed)?|hack(ed|ers)?|ransomware|leak(ed)?|vulnerabilit(y|ies)|cyberattack|zero-day)\b/i },
  { label: 'first or record', points: 0.5, re: /\b(first[- ]ever|first|record|unprecedented|historic|landmark|biggest|largest)\b/i },
  { label: 'big money', points: 0.5, re: /\b(billions?|trillions?)\b|\$\d+(\.\d+)?\s?(bn|b|billion|trillion|tn)\b/i },
];

export type ClusterScore = {
  score: number;
  /** Distinct outlets (aggregator items count for the outlet that wrote them). */
  breadth: number;
  /** Distinct wire services + major newsrooms. */
  majorOutlets: number;
  impact: number;
  ageHours: number;
  /** Looks like a follow-up to a story in yesterday's edition. */
  isUpdate: boolean;
  /** A wire service flagged it as breaking. */
  breaking: boolean;
  mustInclude: boolean;
  /** Human-readable reasons, for logs and the dry run. */
  why: string[];
};

/** Headline + source titles of every story in an edition, as word sets. */
export function editionTokenSets(stories: { headline: string; allSources?: { title?: string }[] }[]): Set<string>[] {
  return stories.map((s) => storyTokens([s.headline, ...(s.allSources ?? []).map((x) => x.title ?? '')].join(' ')));
}

/** True if a cluster is about the same event as any of `known` (stories already published). */
export function matchesAny(c: Cluster, known: Set<string>[], minOverlap = 0.5): boolean {
  if (!known.length) return false;
  const words = c.items.map((it) => storyTokens(it.title));
  return words.some((w) => known.some((k) => overlap(w, k) >= minOverlap));
}

export function scoreCluster(c: Cluster, opts: { now: Date; previous?: Set<string>[] }): ClusterScore {
  const breadth = c.outlets.length;
  const majors = c.outlets.filter(isMajorOutlet);
  const trustWeight = c.outlets.reduce((n, o) => n + TRUST_WEIGHT[outletInfo(o).trust], 0);

  const text = c.items.map((it) => `${it.title} ${it.summary.slice(0, 200)}`).join(' ');
  const hits = IMPACT_RULES.filter((r) => r.re.test(text));
  const official = c.items.some((it) => itemCategory(it) === 'official');
  const impact = Math.min(6, hits.reduce((n, r) => n + r.points, 0) + (official ? 1 : 0));

  const ageHours = Math.max(0, (opts.now.getTime() - Date.parse(c.latestAt)) / 3_600_000);
  const fresh = Math.max(0, 1 - ageHours / 24) * 2;
  const isUpdate = matchesAny(c, opts.previous ?? []);
  const breaking = c.items.some((it) => it.breaking && itemCategory(it) === 'wire');
  const anyBreaking = c.items.some((it) => it.breaking);

  const score =
    Math.min(breadth, 15) * 2 + // coverage breadth: the strongest signal
    majors.length * 1.2 +
    trustWeight +
    impact +
    fresh +
    (anyBreaking ? 3 : 0) -
    (isUpdate ? 2.5 : 0);

  const mustInclude = majors.length >= MUST_INCLUDE_MAJOR_OUTLETS || breaking;
  const why = [
    `${breadth} outlets (${majors.length} major)`,
    ...hits.map((h) => h.label),
    ...(official ? ['official source'] : []),
    ...(breaking ? ['wire: breaking'] : anyBreaking ? ['flagged breaking'] : []),
    ...(isUpdate ? ['update to an ongoing story'] : []),
    `${Math.round(ageHours)}h old`,
  ];
  return { score: Math.round(score * 10) / 10, breadth, majorOutlets: majors.length, impact, ageHours, isUpdate, breaking, mustInclude, why };
}

/** Scores every cluster; returns them best-first alongside a lookup by id. */
export function rankClusters(clusters: Cluster[], opts: { now: Date; previous?: Set<string>[] }) {
  const scores = new Map(clusters.map((c) => [c.id, scoreCluster(c, opts)] as const));
  const ranked = [...clusters].sort((a, b) => scores.get(b.id)!.score - scores.get(a.id)!.score);
  return { ranked, scores };
}

/** Big enough for a breaking-news push during the day. */
export function isPushWorthy(s: ClusterScore): boolean {
  return s.breaking || s.majorOutlets >= BREAKING_PUSH_MAJOR_OUTLETS;
}
