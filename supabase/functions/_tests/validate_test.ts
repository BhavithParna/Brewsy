import { assert, assertEquals } from 'jsr:@std/assert@1';

import { validateAnswer, validateDeepDive, validateEdition, validatePicks } from '../_shared/validate.ts';
import type { Topic } from '../_shared/types.ts';
import { goodStory } from './fixtures.ts';

const TOPICS: Topic[] = ['ai', 'tech', 'business', 'world'];
const known = new Set(['c1', 'c2', 'c3', 'c4', 'c5', 'c6']);

export function goodEdition() {
  return {
    summary: ['One.', 'Two.', 'Three.', 'Four.', 'Five.'],
    calendar: [{ time: '1:00 PM ET', title: 'Auction results', topic: 'business' }, { time: '', title: 'Vote', topic: 'sports' }, { title: '' }],
    stories: ['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => goodStory(id)),
  };
}

Deno.test('a good edition passes and is normalized', () => {
  const v = validateEdition(goodEdition(), { known, topics: TOPICS, minStories: 5 });
  assert(v.ok);
  if (!v.ok) return;
  assertEquals(v.value.summary.length, 4);
  assertEquals(v.value.stories[0].headline, 'Headline for c1'); // trailing period removed
  assertEquals(v.value.stories[0].keyPlayers.length, 1);
  assertEquals(v.value.stories[0].whatToWatch.length, 3);
  assertEquals(v.value.calendar, [{ time: '1:00 PM ET', title: 'Auction results', topic: 'business' }, { time: null, title: 'Vote' }]);
});

Deno.test('missing text, unknown ids, bad topic and duplicates are rejected', () => {
  const e = goodEdition();
  e.stories[0].background = '';
  e.stories[1].clusterIds = ['c99'];
  e.stories[2].topic = 'sports' as Topic;
  e.stories[4] = { ...goodStory('c4') }; // duplicate of stories[3]
  const v = validateEdition(e, { known, topics: TOPICS, minStories: 5 });
  assert(!v.ok);
  if (v.ok) return;
  assert(v.errors.some((x) => x.includes('missing background')));
  assert(v.errors.some((x) => x.includes('clusterIds')));
  assert(v.errors.some((x) => x.includes('topic "sports"')));
  assert(v.errors.some((x) => x.includes('at least 5 valid stories, got 1')));
});

Deno.test('too few summary sentences fails', () => {
  const v = validateEdition({ ...goodEdition(), summary: ['One.', 'Two.'] }, { known, topics: TOPICS, minStories: 5 });
  assert(!v.ok);
});

Deno.test('disabled topics are not allowed', () => {
  const v = validateEdition(goodEdition(), { known, topics: ['ai', 'world'], minStories: 5 });
  assert(!v.ok);
});

Deno.test('non-object replies fail cleanly', () => {
  assert(!validateEdition(null, { known, topics: TOPICS, minStories: 5 }).ok);
  assert(!validateEdition([], { known, topics: TOPICS, minStories: 5 }).ok);
});

Deno.test('picks: merges alsoClusterIds, skips unknown/duplicate, enforces topics', () => {
  const v = validatePicks({
    picks: [
      { clusterId: 'c1', topic: 'tech', alsoClusterIds: ['c2', 'c99'] },
      { clusterId: 'c2', topic: 'tech' },
      { clusterId: 'c3', topic: 'ai' },
      { clusterId: 'c4', topic: 'world' },
      { clusterId: 'c5', topic: 'business' },
      { clusterId: 'c6', topic: 'world' },
      { clusterId: 'c7', topic: 'world' },
    ],
  }, known, TOPICS);
  assert(v.ok);
  if (!v.ok) return;
  assertEquals(v.value[0].clusterIds, ['c1', 'c2']);
  assertEquals(v.value.length, 5);
  assert(!validatePicks({ picks: [] }, known, TOPICS).ok);
});

Deno.test('deep dive + answer validators', () => {
  assert(!validateDeepDive({ context: 'short', openQuestions: ['?'] }).ok);
  const ok = validateDeepDive({
    context: 'x'.repeat(300),
    perspectives: [{ label: 'Google', text: 'Fell short.' }, { label: '', text: 'dropped' }],
    numbers: [{ figure: '€13bn', meaning: 'investment' }],
    openQuestions: ['Will work resume?'],
  });
  assert(ok.ok);
  if (ok.ok) assertEquals(ok.value.perspectives.length, 1);
  assert(validateAnswer({ answer: 'Yes.', answeredFromSources: true }).ok);
  assert(!validateAnswer({ answer: 'Yes.' }).ok);
});
