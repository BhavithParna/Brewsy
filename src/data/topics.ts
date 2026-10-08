import type { Topic } from './types';

/** Topic bubbles include Markets, which isn't a story topic. */
export type TopicKey = Topic | 'markets';

export const TOPIC_LABEL: Record<TopicKey, string> = {
  ai: 'AI',
  tech: 'Tech',
  business: 'Business',
  world: 'World',
  politics: 'Politics',
  science: 'Science',
  health: 'Health',
  climate: 'Climate',
  autos: 'Cars',
  gaming: 'Gaming',
  sports: 'Sports',
  entertainment: 'Entertainment',
  crypto: 'Crypto',
  markets: 'Markets',
};

/** One line under each topic in onboarding and Settings. */
export const TOPIC_BLURB: Record<Topic, string> = {
  ai: 'Models, labs, chips and the rules around them',
  tech: 'Platforms, gadgets, apps and security',
  business: 'Companies, deals, jobs and the economy',
  world: 'Conflict, diplomacy and global affairs',
  politics: 'Elections, governments and policy',
  science: 'Discoveries, research and space',
  health: 'Medicine, public health and wellbeing',
  climate: 'Energy, weather and the environment',
  autos: 'Carmakers, EVs, self-driving and car launches',
  gaming: 'Games, consoles, studios and esports',
  sports: 'Cricket, football, F1, tennis and more',
  entertainment: 'Film, TV, music and streaming',
  crypto: 'Bitcoin, tokens, exchanges and regulation',
};

/** Topics a new reader starts with (all of them can be switched on in Settings). */
export const DEFAULT_TOPICS: Topic[] = ['ai', 'tech', 'business', 'world', 'politics', 'science'];
