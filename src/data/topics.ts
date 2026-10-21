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
  oceans: 'Oceans',
  autos: 'Cars',
  gaming: 'Gaming',
  sports: 'Sports',
  entertainment: 'Entertainment',
  movies: 'Movies',
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
  oceans: 'Sea life, the deep sea, ocean science and the health of the seas',
  autos: 'Carmakers, EVs, self-driving and car launches',
  gaming: 'Games, consoles, studios and esports',
  sports: 'Cricket, football, F1, tennis and more',
  entertainment: 'TV, music, streaming and celebrities',
  movies: 'Hollywood, Bollywood, world and indie cinema, box office',
  crypto: 'Bitcoin, tokens, exchanges and regulation',
};

/** Topics a new reader starts with (all of them can be switched on in Settings). */
export const DEFAULT_TOPICS: Topic[] = ['ai', 'tech', 'business', 'world', 'politics', 'science'];
