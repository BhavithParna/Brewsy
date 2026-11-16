// Who owns each outlet, and where it is based. Shown beside a story's sources so a reader can see
// what kind of newsrooms a story came from (How it was covered, under Learn more) and on an article
// check.
//
// These are facts about ownership, written by hand and checked against what each company says about
// itself; they are NOT ratings of quality, accuracy or politics. Ownership changes: `OUTLETS_AS_OF`
// says when this list was last gone over. An outlet that isn't here simply shows no ownership line;
// never guess one.

import { normalizeOutlet } from '../../supabase/functions/_shared/sources';

export const OUTLETS_AS_OF = 'November 2026';

/** The kind of owner, from the reader's point of view: who could lean on the newsroom. */
export type Ownership =
  | 'public' // public-service broadcaster or agency: publicly funded, run at arm's length from government
  | 'state' // owned or funded by a government that also directs it
  | 'conglomerate' // part of a large media or entertainment group
  | 'telecom' // owned by a telecom or cable company
  | 'tech' // owned by a technology company
  | 'private-equity' // owned by a private-equity firm or investment fund
  | 'individual' // owned by one wealthy person
  | 'family' // controlled by a founding family, often through a listed company
  | 'trust' // owned by a trust or foundation set up to protect the newsroom
  | 'nonprofit' // non-profit newsroom, cooperative, university or society
  | 'independent' // owned by its founders or its journalists
  | 'company' // a company or lab writing about itself (a primary source, not a newsroom)
  | 'government'; // a government body's own announcements (a primary source)

export const OWNERSHIP_LABEL: Record<Ownership, string> = {
  public: 'Public broadcaster',
  state: 'State-funded',
  conglomerate: 'Media group',
  telecom: 'Telecom-owned',
  tech: 'Tech-owned',
  'private-equity': 'Investment fund',
  individual: 'One owner',
  family: 'Family-controlled',
  trust: 'Trust-owned',
  nonprofit: 'Non-profit',
  independent: 'Independent',
  company: 'Company newsroom',
  government: 'Government',
};

/** One line on what each kind means, for the note under the list. */
export const OWNERSHIP_MEANING: Record<Ownership, string> = {
  public: 'Publicly funded, run at arm’s length from the government.',
  state: 'Funded by a government that also has a say in it.',
  conglomerate: 'Part of a large media or entertainment group.',
  telecom: 'Owned by a telecom or cable company.',
  tech: 'Owned by a technology company.',
  'private-equity': 'Owned by a private-equity firm or investment fund.',
  individual: 'Owned by one wealthy person.',
  family: 'Controlled by a founding family.',
  trust: 'Owned by a trust set up to protect the newsroom.',
  nonprofit: 'A non-profit, cooperative, university or society.',
  independent: 'Owned by its founders or its journalists.',
  company: 'A company writing about itself: a primary source, not a newsroom.',
  government: 'A government body’s own announcement: a primary source.',
};

export type OutletProfile = {
  ownership: Ownership;
  /** Who, in a few words. */
  owner: string;
  /** Where the newsroom is based. */
  country: string;
};

const p = (ownership: Ownership, owner: string, country: string): OutletProfile => ({ ownership, owner, country });

const PROFILES: Record<string, OutletProfile> = {
  // Wires
  Reuters: p('conglomerate', 'Thomson Reuters', 'UK'),
  'AP News': p('nonprofit', 'A cooperative of US news organisations', 'US'),
  AFP: p('public', 'Agence France-Presse, a public agency', 'France'),

  // United States
  'New York Times': p('family', 'The New York Times Company (Ochs-Sulzberger family)', 'US'),
  'Wall Street Journal': p('conglomerate', 'Dow Jones, part of News Corp (Murdoch family)', 'US'),
  MarketWatch: p('conglomerate', 'Dow Jones, part of News Corp (Murdoch family)', 'US'),
  'Washington Post': p('individual', 'Jeff Bezos', 'US'),
  Bloomberg: p('individual', 'Bloomberg L.P. (Michael Bloomberg)', 'US'),
  'NBC News': p('telecom', 'NBCUniversal, part of Comcast', 'US'),
  'CBS News': p('conglomerate', 'Paramount Skydance', 'US'),
  'CBS Sports': p('conglomerate', 'Paramount Skydance', 'US'),
  'ABC News': p('conglomerate', 'The Walt Disney Company', 'US'),
  CNN: p('conglomerate', 'Warner Bros. Discovery', 'US'),
  'Fox News': p('conglomerate', 'Fox Corporation (Murdoch family)', 'US'),
  NPR: p('nonprofit', 'National Public Radio, a non-profit', 'US'),
  'PBS News': p('nonprofit', 'Public Broadcasting Service member stations', 'US'),
  Axios: p('family', 'Cox Enterprises (Cox family)', 'US'),
  Politico: p('conglomerate', 'Axel Springer', 'US'),
  'The Hill': p('conglomerate', 'Nexstar Media Group', 'US'),
  'Yahoo News': p('private-equity', 'Yahoo, owned by Apollo Global Management', 'US'),
  TechCrunch: p('private-equity', 'Regent', 'US'),
  'The Verge': p('conglomerate', 'Vox Media', 'US'),
  Wired: p('family', 'Condé Nast, part of Advance (Newhouse family)', 'US'),
  'Ars Technica': p('family', 'Condé Nast, part of Advance (Newhouse family)', 'US'),
  'MIT Technology Review': p('nonprofit', 'Massachusetts Institute of Technology', 'US'),
  '404 Media': p('independent', 'Its journalists', 'US'),
  Techmeme: p('independent', 'Its founder', 'US'),
  'Hacker News': p('company', 'Y Combinator', 'US'),
  Variety: p('conglomerate', 'Penske Media', 'US'),
  Deadline: p('conglomerate', 'Penske Media', 'US'),
  IndieWire: p('conglomerate', 'Penske Media', 'US'),
  'The Hollywood Reporter': p('conglomerate', 'Penske Media and Eldridge', 'US'),
  Billboard: p('conglomerate', 'Penske Media and Eldridge', 'US'),
  IGN: p('conglomerate', 'Ziff Davis', 'US'),
  'Car and Driver': p('family', 'Hearst (Hearst family)', 'US'),
  STAT: p('individual', 'Boston Globe Media (John Henry)', 'US'),
  Science: p('nonprofit', 'American Association for the Advancement of Science', 'US'),
  'Inside Climate News': p('nonprofit', 'A non-profit newsroom', 'US'),
  Grist: p('nonprofit', 'A non-profit newsroom', 'US'),
  Mongabay: p('nonprofit', 'A non-profit newsroom', 'US'),
  'Mongabay India': p('nonprofit', 'A non-profit newsroom', 'India'),
  'Yale Environment 360': p('nonprofit', 'Yale School of the Environment', 'US'),
  CoinDesk: p('company', 'Bullish, a crypto exchange', 'US'),
  ESPNcricinfo: p('conglomerate', 'ESPN, part of The Walt Disney Company', 'India'),

  // United Kingdom and Europe
  'BBC News': p('public', 'BBC, funded by the licence fee', 'UK'),
  'The Guardian': p('trust', 'The Scott Trust', 'UK'),
  'Guardian Australia': p('trust', 'The Scott Trust', 'Australia'),
  'Financial Times': p('conglomerate', 'Nikkei', 'UK'),
  'The Economist': p('family', 'The Economist Group (Exor is the largest shareholder)', 'UK'),
  'Sky News': p('telecom', 'Sky, part of Comcast', 'UK'),
  'Sky Sports': p('telecom', 'Sky, part of Comcast', 'UK'),
  'The Independent': p('individual', 'Evgeny Lebedev and other private shareholders', 'UK'),
  'Evening Standard': p('individual', 'Evgeny Lebedev', 'UK'),
  'The i Paper': p('family', 'DMGT (Rothermere family)', 'UK'),
  'New Scientist': p('family', 'DMGT (Rothermere family)', 'UK'),
  Nature: p('conglomerate', 'Springer Nature', 'UK'),
  Eurogamer: p('conglomerate', 'Ziff Davis', 'UK'),
  'GamesIndustry.biz': p('conglomerate', 'Ziff Davis', 'UK'),
  'PC Gamer': p('conglomerate', 'Future', 'UK'),
  Autocar: p('family', 'Haymarket Media Group (Heseltine family)', 'UK'),
  'Deutsche Welle': p('public', 'Germany’s international broadcaster, federally funded', 'Germany'),
  'France 24': p('state', 'France Médias Monde, owned by the French state', 'France'),

  // Canada
  'CBC News': p('public', 'CBC/Radio-Canada', 'Canada'),
  'CTV News': p('telecom', 'Bell Media, part of BCE', 'Canada'),
  'Global News': p('conglomerate', 'Corus Entertainment', 'Canada'),
  'National Post': p('private-equity', 'Postmedia (Chatham Asset Management is the largest holder)', 'Canada'),
  'The Globe and Mail': p('family', 'Woodbridge (Thomson family)', 'Canada'),

  // Australia
  'ABC Australia': p('public', 'Australian Broadcasting Corporation', 'Australia'),
  'SBS News': p('public', 'Special Broadcasting Service', 'Australia'),
  'The Sydney Morning Herald': p('conglomerate', 'Nine Entertainment', 'Australia'),
  'Australian Financial Review': p('conglomerate', 'Nine Entertainment', 'Australia'),

  // India
  'The Hindu': p('family', 'The Hindu Group (Kasturi family)', 'India'),
  'The Indian Express': p('family', 'Indian Express Group (Goenka family)', 'India'),
  'The Times of India': p('family', 'Bennett, Coleman & Co. (Jain family)', 'India'),
  'Hindustan Times': p('family', 'HT Media (Bhartia family)', 'India'),
  Onmanorama: p('family', 'Malayala Manorama (Kandathil family)', 'India'),

  // Elsewhere
  'Al Jazeera': p('state', 'Al Jazeera Media Network, funded by Qatar', 'Qatar'),
  'South China Morning Post': p('tech', 'Alibaba Group', 'Hong Kong'),
  Rappler: p('independent', 'Its founders and journalists', 'Philippines'),

  // Primary sources: not newsrooms
  Anthropic: p('company', 'Anthropic’s own announcements', 'US'),
  Apple: p('company', 'Apple’s own announcements', 'US'),
  Google: p('company', 'Google’s own announcements', 'US'),
  'Google DeepMind': p('company', 'Google DeepMind’s own announcements', 'UK'),
  Meta: p('company', 'Meta’s own announcements', 'US'),
  Microsoft: p('company', 'Microsoft’s own announcements', 'US'),
  Nvidia: p('company', 'Nvidia’s own announcements', 'US'),
  OpenAI: p('company', 'OpenAI’s own announcements', 'US'),
  'Federal Reserve': p('government', 'The US central bank', 'US'),
  'SEC filings': p('government', 'Company filings with the US regulator', 'US'),
  'White House': p('government', 'The US president’s office', 'US'),
  NASA: p('government', 'The US space agency', 'US'),
  MBARI: p('nonprofit', 'Monterey Bay Aquarium Research Institute', 'US'),
  WHOI: p('nonprofit', 'Woods Hole Oceanographic Institution', 'US'),
};

/** The outlet's profile, or null when Brewsy has no ownership on file for it. */
export function outletProfile(outlet: string): OutletProfile | null {
  return PROFILES[normalizeOutlet(outlet)] ?? null;
}

/**
 * Wording checks on a headline: the habits of headlines written to be clicked. They read the words
 * only, so they say nothing about whether the reporting underneath is good.
 */
export type HeadlineSignal = 'question' | 'teaser' | 'charged';

export const SIGNAL_LABEL: Record<HeadlineSignal, string> = {
  question: 'Asks, doesn’t tell',
  teaser: 'Teaser',
  charged: 'Charged wording',
};

const TEASER =
  /\b(here(?:'|’)?s (?:why|what|how)|this is (?:why|what|how)|what (?:you|we) need to know|you won(?:'|’)?t believe|the (?:real )?reason|one (?:thing|trick)|everything (?:you|we) (?:need|know)|what happened next|find out)\b|^\d+ (?:things|ways|reasons|signs)\b/i;
const CHARGED =
  /\b(shocking|stunn(?:ing|ed)|slams?|slammed|blasts?|blasted|destroys?|destroyed|rips|ripped|furious|fury|outrage[ds]?|insane|unbelievable|jaw-dropping|bombshell|explosive|chaos|meltdown|epic|brutal|savage|humiliat(?:es|ed|ing)|terrifying|horrif(?:ic|ying)|disaster)\b/i;

export function headlineSignals(title: string | undefined): HeadlineSignal[] {
  if (!title) return [];
  const out: HeadlineSignal[] = [];
  if (/\?\s*$/.test(title.trim())) out.push('question');
  if (TEASER.test(title)) out.push('teaser');
  if (CHARGED.test(title)) out.push('charged');
  return out;
}
