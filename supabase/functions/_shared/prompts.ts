// Every instruction we give the AI, plus the JSON shapes we ask for.

import type { Cluster } from './dedupe.ts';
import type { JsonSchema } from './llm.ts';
import type { ClusterScore } from './scoring.ts';
import type { Topic } from './types.ts';

const TOPIC_GUIDE = `Topics (choose the single best fit for each story):
- ai: AI models, AI companies and labs, AI chips and compute, AI policy and safety
- tech: other technology: devices, software, platforms, the internet, cybersecurity, telecom
- business: the economy, markets, interest rates, companies, deals, jobs, trade
- world: international affairs and major events: wars and conflicts, diplomacy, terrorism, natural disasters, big news from other countries
- politics: elections, governments, parliaments, courts and policy fights, in any country (India and the US included); a war or a diplomatic story is world, not politics
- science: research and discoveries, space and astronomy, science prizes
- health: medicine, drugs and vaccines, disease outbreaks, public health, health care
- climate: climate change, emissions and climate policy, the energy transition, the environment and wildlife
- autos: carmakers, electric vehicles, self-driving cars, car launches, sales and recalls (races and race results are sports)
- gaming: video games, consoles, game studios and publishers, esports
- sports: matches, results, tournaments, transfers and players: cricket, football, Formula 1, tennis, the Olympics and more
- entertainment: film, TV, streaming, music, books and the arts, awards, the entertainment industry (no celebrity gossip)
- crypto: bitcoin and other cryptocurrencies, exchanges, blockchain companies, crypto regulation`;

const FACT_RULES = `Ground rules (most important):
- Use ONLY facts stated in the provided articles. Never add facts, numbers, names, dates, places or quotes that are not in them.
- If the articles don't say something, leave it out. Writing less is always better than guessing.
- Background and context must also come from the articles. Do not fill gaps from memory.
- Neutral and calm: no hype, no opinion, no clickbait, no exclamation marks.
- Plain, precise English for a smart reader who is not an expert.`;

// ─── Pass 1: choose the stories ────────────────────────────────────────────

export const PICK_SYSTEM = `You are the editor of Brewsy, a calm morning news briefing that someone reads top to bottom in a few minutes.
You choose which stories make today's edition. Missing a major story is the worst mistake you can make.
${TOPIC_GUIDE}`;

export function pickSchema(topics: Topic[]): JsonSchema {
  return {
    type: 'object',
    properties: {
      picks: {
        type: 'array',
        maxItems: 16,
        description: 'Chosen stories, most important first. Include every MUST candidate.',
        items: {
          type: 'object',
          properties: {
            clusterId: { type: 'string', description: 'Candidate id, e.g. "c12".' },
            topic: { type: 'string', enum: topics },
            alsoClusterIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Other candidate ids that cover the SAME event (optional).',
            },
          },
          required: ['clusterId', 'topic'],
        },
      },
    },
    required: ['picks'],
  };
}

/** How a candidate is shown to the editor. */
export type ScoredCandidate = { cluster: Cluster; score: ClusterScore };

function candidateLine({ cluster: c, score: s }: ScoredCandidate, now: Date): string {
  const age = Math.max(0, Math.round((now.getTime() - Date.parse(c.latestAt)) / 3_600_000));
  const flags = [s.mustInclude ? 'MUST' : '', s.breaking ? 'BREAKING' : '', s.isUpdate ? 'update' : ''].filter(Boolean).join(' ');
  const teaser = c.summary ? ` — ${c.summary.slice(0, 180)}` : '';
  const outlets = c.outlets.slice(0, 8).join(', ') + (c.outlets.length > 8 ? ` +${c.outlets.length - 8} more` : '');
  return `[${c.id}] score ${s.score} · ${s.breadth} outlets (${s.majorOutlets} major)${flags ? ` · ${flags}` : ''} · ${outlets} · hint ${c.topicHints.join('/')} · ${age}h ago · ${c.title}${teaser}`;
}

export function pickPrompt(candidates: ScoredCandidate[], topics: Topic[], date: string, now: Date, target: number, followed: Topic[] = topics): string {
  const must = candidates.filter((c) => c.score.mustInclude).map((c) => c.cluster.id);
  const focus = followed.length && followed.length < topics.length
    ? `\nThe reader follows ${followed.join(', ')} and sees only those topics until they switch others on, so give each of them depth: 2–4 stories where the news supports it.`
    : '';
  return `Edition date: ${date}. Topics to include: ${topics.join(', ')}.

Below are ${candidates.length} candidate stories from the last 24 hours, best-scored first. Each line is one candidate:
[id] score · how many outlets covered it (how many are wire services or major newsrooms) · flags · outlets · topic hint · age · headline — teaser

The score already weighs coverage breadth (the strongest signal), source weight, impact and newness. Use it as a strong guide, then apply judgment.
${must.length ? `These are MUST candidates (covered by 5+ major outlets or flagged breaking by a wire service). They are always in the edition, whatever the limit, so list every one of them: ${must.join(', ')}.
` : ''}
Choose about ${target} stories in total (at least 5 if the news is thin; MUST candidates don't count against the limit).
Prefer: hard news with real consequences; stories covered by many outlets; brand-new developments over small updates to ongoing stories; major company, policy, economy, AI and science news.
Skip: shopping deals, product promotions, reviews, opinion columns, listicles, rumours, celebrity gossip, horoscopes, match previews, and local crime unless it is nationally significant.
Coverage: readers follow different topics, so give every listed topic that has real news today its single most important story. The big general topics (world, politics, business, tech, AI) get more. Gaming, sports, entertainment, autos and crypto get one story each unless something genuinely major happened there. If a topic has no real news, leave it out.${focus}
If two candidates are the same event, pick one and put the other in alsoClusterIds.
Rank by importance: the first pick is the top story.

${candidates.map((c) => candidateLine(c, now)).join('\n')}`;
}

// ─── Pass 1b: the editor's checklist (the safety net) ──────────────────────

export const CHECK_CATEGORIES = [
  'markets', 'central-banks', 'economic-data', 'earnings', 'ai-launch', 'ai-policy', 'deals',
  'politics', 'conflict', 'disaster', 'death', 'security', 'science-health', 'sport', 'culture', 'other',
] as const;

export const EDITOR_SYSTEM = `You are the second editor at Brewsy, a calm morning news briefing. Your job is the safety net:
make sure nothing that matters today is left out, and give everything else noteworthy one line.
Use ONLY what the candidate headlines and teasers say. Never add facts, numbers or names that aren't there.
Neutral and calm: no hype, no opinion.
${TOPIC_GUIDE}`;

export function editorSchema(topics: Topic[]): JsonSchema {
  const str = (description: string) => ({ type: 'string', description });
  return {
    type: 'object',
    properties: {
      additions: {
        type: 'array',
        maxItems: 4,
        description: 'Candidates an informed person would be embarrassed not to know today. They get a full story. Often empty.',
        items: {
          type: 'object',
          properties: {
            clusterId: str('Candidate id, e.g. "c41".'),
            topic: { type: 'string', enum: topics },
            category: { type: 'string', enum: [...CHECK_CATEGORIES] },
            reason: str('One short line: why it cannot be left out.'),
          },
          required: ['clusterId', 'topic', 'category', 'reason'],
        },
      },
      alsoHappening: {
        // Gemini rejects this schema (HTTP 400, "invalid argument") at 30 items; 15 works.
        type: 'array',
        maxItems: 15,
        description: 'Other noteworthy candidates (not additions, not already selected), most important first, spread across the topics.',
        items: {
          type: 'object',
          properties: {
            clusterIds: { type: 'array', items: { type: 'string' }, description: 'The candidate id(s) for this item.' },
            topic: { type: 'string', enum: topics },
            headline: str('The one line: a plain sentence of at most 16 words, no trailing period.'),
            whatHappened: str('2–3 short sentences with the facts from the headline and teaser.'),
            whyItMatters: str('One sentence on the consequence if the teaser supports it, otherwise an empty string.'),
            developing: { type: 'boolean', description: 'True if it is still unfolding.' },
          },
          required: ['clusterIds', 'topic', 'headline', 'whatHappened', 'whyItMatters', 'developing'],
        },
      },
    },
    required: ['additions', 'alsoHappening'],
  };
}

export function editorPrompt(selected: ScoredCandidate[], rest: ScoredCandidate[], date: string, now: Date): string {
  return `Edition date: ${date}.

ALREADY IN TODAY'S EDITION (full stories):
${selected.map((c) => `- ${c.cluster.title}`).join('\n')}

NOT SELECTED (${rest.length} candidates, best-scored first):
${rest.map((c) => candidateLine(c, now)).join('\n')}

1) Is anything in NOT SELECTED something an informed person would be embarrassed not to know today?
Check these categories explicitly:
- Big market moves, Fed and interest-rate decisions, major economic data (jobs, inflation)
- Earnings from the largest companies
- Major AI model or product launches; big AI policy or regulation news
- Large funding rounds, acquisitions, layoffs, IPOs
- Elections, major political decisions, wars and conflicts, natural disasters, major deaths
- Big security breaches and outages
- Major science or health news (a big discovery, an outbreak, a drug approval)
- The biggest sports results (a final, a world record) and the biggest entertainment news
Put those in "additions" (at most 4). Don't add anything that is the same event as a story already in the edition. It's fine to add nothing.

2) "Also happening": from the remaining NOT SELECTED candidates, choose up to 15 noteworthy items that didn't get a full story, most important first, and write each as one line plus a short "learn more" text.
Readers follow different topics, so spread the list: where there is real news, give every topic at least one item (including science, health, climate, autos, gaming, sports, entertainment and crypto) before giving any topic a third.
Skip duplicates of the edition, junk (shopping deals, promotions, reviews, opinion, listicles, gossip, rumours) and anything trivial. Merge candidates about the same event into one item (list all their ids).`;
}

// ─── Pass 2: write the stories (in parallel batches) ───────────────────────

export const EDITION_SYSTEM = `You are the editor of Brewsy, a calm morning news briefing.
${FACT_RULES}
${TOPIC_GUIDE}`;

function storyItemSchema(topics: Topic[]): JsonSchema {
  const str = (description: string) => ({ type: 'string', description });
  return {
    type: 'object',
    properties: {
      clusterIds: { type: 'array', minItems: 1, items: { type: 'string' }, description: 'Echo the STORY block ids exactly.' },
      topic: { type: 'string', enum: topics },
      headline: str('Max ~10 words, sentence case, no trailing period.'),
      dek: str('One line (max ~18 words) that adds to the headline.'),
      whatHappened: str('2–4 sentences: the facts.'),
      whyItMatters: str('1–3 sentences: the consequence for ordinary people, markets or the world, as supported by the articles.'),
      explainSimply: str('2–3 sentences in very plain words, including one everyday analogy.'),
      background: str('1–2 short paragraphs (separate with a blank line) on how we got here, ONLY from the articles.'),
      keyPlayers: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          properties: { name: str('Company, person, country or group.'), role: str('Their part in this story, one short line.') },
          required: ['name', 'role'],
        },
      },
      keyTerms: {
        type: 'array',
        maxItems: 4,
        description: 'Jargon used in the story, each defined in one line. Empty if there is none.',
        items: {
          type: 'object',
          properties: { term: { type: 'string' }, definition: { type: 'string' } },
          required: ['term', 'definition'],
        },
      },
      whatToWatch: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        items: { type: 'string' },
        description: 'Concrete next steps the articles point to (deadlines, decisions, pending responses).',
      },
      developing: {
        type: 'boolean',
        description: 'True if the situation is still unfolding (outcome or key facts not settled yet).',
      },
    },
    required: [
      'clusterIds', 'topic', 'headline', 'dek', 'whatHappened', 'whyItMatters',
      'explainSimply', 'background', 'keyPlayers', 'keyTerms', 'whatToWatch', 'developing',
    ],
  };
}

export function storiesSchema(topics: Topic[], storyCount: number): JsonSchema {
  return {
    type: 'object',
    properties: {
      stories: { type: 'array', minItems: storyCount, maxItems: storyCount, items: storyItemSchema(topics) },
    },
    required: ['stories'],
  };
}

export type StoryBlock = {
  clusterIds: string[];
  topic: Topic;
  articles: { outlet: string; title: string; publishedAt: string; text: string }[];
};

function blocksText(blocks: StoryBlock[]): string {
  return blocks
    .map((b, k) => {
      const arts = b.articles
        .map((a, i) => `[A${i + 1}] ${a.outlet} — "${a.title}" (published ${a.publishedAt})\n${a.text}`)
        .join('\n\n');
      return `=== STORY ${k + 1} · clusterIds: ${b.clusterIds.join(', ')} · suggested topic: ${b.topic} ===\n${arts}`;
    })
    .join('\n\n');
}

export function storiesPrompt(blocks: StoryBlock[], date: string, timezone: string): string {
  return `Edition date: ${date} (reader's timezone: ${timezone}).

Write one story for each of the ${blocks.length} STORY blocks below, in the same order.
Each block holds one or more articles about the same event. Some articles may only have a headline and a short teaser; use what is there and nothing more.
Echo each block's clusterIds exactly. You may change the topic if the suggested one is clearly wrong.
Set "developing" to true when the articles describe something still unfolding (an ongoing rescue, talks or vote still under way, numbers still changing, an outcome not yet known).

${blocksText(blocks)}`;
}

// ─── Pass 2b: the 60-second version + calendar ─────────────────────────────

export function summarySchema(topics: Topic[]): JsonSchema {
  return {
    type: 'object',
    properties: {
      summary: {
        type: 'array',
        minItems: 4,
        maxItems: 4,
        items: { type: 'string' },
        description: '"The 60-second version": exactly 4 one-sentence takeaways covering the most important stories.',
      },
      calendar: {
        type: 'array',
        maxItems: 6,
        description: 'Scheduled events today or in the next few days that the articles explicitly mention. Empty if none.',
        items: {
          type: 'object',
          properties: {
            time: { type: 'string', description: 'As written in the article, e.g. "1:00 PM ET", "Today", "Thu", "Oct 23". Empty string if not given.' },
            title: { type: 'string', description: 'Short description of the event.' },
            topic: { type: 'string', enum: topics },
          },
          required: ['time', 'title', 'topic'],
        },
      },
    },
    required: ['summary', 'calendar'],
  };
}

export function summaryPrompt(blocks: StoryBlock[], date: string, timezone: string): string {
  return `Edition date: ${date} (reader's timezone: ${timezone}).

These are today's top stories, most important first. Write "the 60-second version" (exactly 4 one-sentence takeaways, most important first) and list any scheduled events the articles mention.

${blocksText(blocks)}`;
}

// ─── Listening scripts (the audio briefing) ────────────────────────────────

export const SCRIPT_SYSTEM = `You write the spoken script for Brewsy's audio briefing, read aloud by a calm radio news host.
${FACT_RULES}
Write for the ear, not the eye:
- Natural spoken sentences, short and clear. No bullet points, no fragments, no headings.
- Never read out web addresses, symbols, emoji or abbreviations a listener can't hear (write "percent", "dollars", "and").
- Round numbers and say them naturally: "about one hundred and one dollars a barrel", "nearly two percent", "around three billion dollars".
- Spell out what a symbol means: "the S&P 500 index", "the 10-year Treasury yield".
- Start each story after the first with a short, varied transition, like "Next, in tech…", "In business…", "Turning to the world…", "Meanwhile, in AI…".
- Calm and neutral. No hype, no opinion, no exclamation marks.`;

export function scriptSchema(): JsonSchema {
  return {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'The 60-second version, spoken: the day in a few sentences.' },
      stories: {
        type: 'array',
        description: 'One entry per story, in the given order.',
        items: {
          type: 'object',
          properties: {
            storyId: { type: 'string', description: 'Echo the story id exactly.' },
            text: { type: 'string', description: 'What the host says for this story.' },
          },
          required: ['storyId', 'text'],
        },
      },
    },
    required: ['summary', 'stories'],
  };
}

export type ScriptStory = { id: string; topic: Topic; headline: string; dek: string; whatHappened: string; whyItMatters: string; developing?: boolean };

export function scriptPrompt(mode: 'quick' | 'full', summary: string[], stories: ScriptStory[], spokenDate: string): string {
  const quick = mode === 'quick';
  const perStory = quick
    ? 'One or two sentences per story (about 25–40 words): just what happened.'
    : 'For every story, what happened and then why it matters (about 90–120 words per story).';
  // Scales with the number of stories (the app plays only the reader's topics).
  const words = quick ? 60 + 35 * stories.length : 110 + 105 * stories.length;
  const length = `about ${Math.max(1, Math.round(words / 150))} minutes in total (roughly ${words.toLocaleString('en-US')} words)`;
  return `Write the ${quick ? 'QUICK LISTEN' : 'FULL BRIEFING'} for ${spokenDate}: ${length}.

The host has already said the greeting ("Good morning, it's ${spokenDate}. Here's what you need to know.") and will close with "That's your briefing. You're all caught up." Don't write either.
- "summary": the 60-second version in spoken form (about ${quick ? '60' : '110'} words), based on the takeaways below.
- "stories": ${perStory} Keep the order. If a story is still developing, say so plainly ("This story is still developing.").

Takeaways:
${summary.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Stories:
${stories
    .map((s, i) => `--- ${i + 1}. storyId: ${s.id} · topic: ${s.topic}${s.developing ? ' · DEVELOPING' : ''}\nHeadline: ${s.headline}\nDek: ${s.dek}\nWhat happened: ${s.whatHappened}\nWhy it matters: ${s.whyItMatters}`)
    .join('\n\n')}`;
}

// ─── Layer 3: Go deeper ────────────────────────────────────────────────────

export const DEEP_DIVE_SYSTEM = `You write the "Go deeper" explainer for Brewsy, a calm news app.
${FACT_RULES}
- Only describe perspectives that the sources themselves present (for example a company's position and its critics'). Never invent viewpoints.
- If the sources hold few numbers, list only the ones they contain.`;

export const DEEP_DIVE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    context: { type: 'string', description: '2–3 paragraphs separated by blank lines: the fuller picture.' },
    perspectives: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        properties: { label: { type: 'string', description: 'Whose view, e.g. "Google" or "Regulators".' }, text: { type: 'string' } },
        required: ['label', 'text'],
      },
    },
    numbers: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        properties: { figure: { type: 'string', description: 'e.g. "€13bn"' }, meaning: { type: 'string' } },
        required: ['figure', 'meaning'],
      },
    },
    openQuestions: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
  },
  required: ['context', 'perspectives', 'numbers', 'openQuestions'],
};

export type SourceText = { name: string; url: string; title?: string; text: string };

function sourcesBlock(sources: SourceText[]): string {
  return sources.map((s, i) => `[S${i + 1}] ${s.name} — "${s.title ?? ''}"\n${s.text}`).join('\n\n');
}

export function deepDivePrompt(story: { headline: string; whatHappened: string; whyItMatters: string; background: string }, sources: SourceText[]): string {
  return `Story: ${story.headline}
Summary already shown to the reader: ${story.whatHappened} ${story.whyItMatters}
Background already shown: ${story.background}

Write a longer explainer of about 400–600 words in total across all fields: context (go beyond the summary), the different perspectives the sources present, the numbers that matter and what they mean, and the open questions the sources leave unanswered.

Sources:
${sourcesBlock(sources)}`;
}

// ─── Layer 3: Ask a question ───────────────────────────────────────────────

export const ASK_SYSTEM = `You answer a reader's question about one news story for Brewsy.
- Answer ONLY from the provided sources. Do not use outside knowledge.
- If the sources don't contain the answer, set answeredFromSources to false and say plainly that the sources for this story don't cover it (you may add what they do say that is related).
- At most 120 words, plain language.`;

export const ASK_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    answeredFromSources: { type: 'boolean' },
  },
  required: ['answer', 'answeredFromSources'],
};

export function askPrompt(headline: string, question: string, sources: SourceText[]): string {
  return `Story: ${headline}
Question: ${question}

Sources:
${sourcesBlock(sources)}`;
}
