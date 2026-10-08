// Shared test fixtures (real headlines from 7 Oct 2026 feeds).

import type { FeedItem } from '../_shared/feeds.ts';
import type { Topic } from '../_shared/types.ts';

let n = 0;
export function item(over: Partial<FeedItem> & Pick<FeedItem, 'outlet' | 'title'>): FeedItem {
  n++;
  return {
    id: `t-${n}`,
    sourceId: over.outlet.toLowerCase().replace(/\W+/g, '-'),
    kind: 'rss',
    topicHint: 'world',
    link: `https://example.com/${n}`,
    summary: '',
    content: '',
    publishedAt: '2026-10-07T08:00:00Z',
    imageUrl: null,
    ...over,
  };
}

export const NOW = new Date('2026-10-07T12:00:00Z');

export function sampleItems(): FeedItem[] {
  return [
    item({ outlet: 'BBC News', topicHint: 'tech', title: 'Finland orders halt to work on two Google data centres', summary: 'The order affecting two planned data centres follows concerns over forest clearance.', link: 'https://www.bbc.co.uk/news/articles/finland' , imageUrl: 'https://ichef.bbci.co.uk/ace/standard/1200/x.jpg' }),
    item({ outlet: 'CNBC', topicHint: 'tech', title: 'Google ordered to halt work on two data centers in ‘Texas of Europe’', summary: 'Finland has emerged as a key location for data centers amid the AI boom.', link: 'https://www.cnbc.com/finland' }),
    item({ outlet: 'BBC News', topicHint: 'world', title: "Chemistry Nobel awarded for solving mystery of life's asymmetry", summary: 'The prize was given to the French and Japanese scientists Henri Kagan and Kenso Soai.' }),
    item({ outlet: 'Reuters', kind: 'google-news', topicHint: 'mixed', title: "Nobel chemistry prize goes to pair who solved mystery of 'mirror image' molecules" }),
    item({ outlet: 'Ars Technica', topicHint: 'tech', title: 'Neutrino physicist wins 2026 Nobel Physics Prize', summary: 'Francis Halzen of University of Wisconsin-Madison led development of IceCube Neutrino Observatory.' }),
    item({ outlet: 'NPR', topicHint: 'business', title: 'Who will win the 2026 Nobel Prize in economics?', summary: 'Economists weigh in on the favourites for this year’s prize.' }),
    item({ outlet: 'CNBC', topicHint: 'business', title: '10-year Treasury note yield hits highest level since 2002 as traders brace for key bond sale', summary: 'U.S. Treasury yields climbed Wednesday after retreating in the previous session.' }),
    item({ outlet: 'Financial Times', topicHint: 'business', title: 'Global bond sell-off resumes as 30-year Treasury yield hits highest since 2002', summary: 'French, Italian and UK government bonds also come under pressure in volatile trading.' }),
    item({ outlet: 'Ars Technica', topicHint: 'tech', title: 'Hackers obtain counterfeit TLS certificates for Google and other large services', summary: 'Compromise of 3 domain registries allows hackers to walk off with unauthorized certs.', content: 'Attackers hijacked three top-level domains and used their control to mint counterfeit TLS certificates for Google. '.repeat(6) }),
    item({ outlet: 'Ars Technica', topicHint: 'tech', title: 'OpenAI will watermark ChatGPT outputs by default—but only in the EU', summary: 'Like other solutions, it is not especially reliable, and it is easy to circumvent.' }),
    item({ outlet: 'BBC News', topicHint: 'world', title: "Ten people linked to Kenya's first-ever Ebola case quarantined as screening concerns grow", summary: 'The patient passed through multiple cities in DR Congo, drove to Uganda and eventually flew to Kenya.' }),
    item({ outlet: 'CNBC', topicHint: 'tech', title: 'Mistral unveils new AI model it says rivals best open systems from China', summary: 'Western developers are racing to compete with Chinese companies in open weight AI.' }),
  ];
}

/** A story as the AI returns it, before validation. */
export function goodStory(id: string, topic: Topic = 'tech') {
  return {
    clusterIds: [id],
    topic,
    headline: `Headline for ${id}.`,
    dek: 'Dek',
    whatHappened: 'A happened. B followed.',
    whyItMatters: 'It matters.',
    explainSimply: 'Like a kettle boiling.',
    background: 'Para one.\n\nPara two.',
    keyPlayers: [{ name: 'Google', role: 'Builder' }, { name: '', role: 'dropped' }],
    keyTerms: [{ term: 'TLS', definition: 'Web encryption.' }],
    whatToWatch: ['Deadline on 23 October', 'x', 'y', 'z'],
  };
}
