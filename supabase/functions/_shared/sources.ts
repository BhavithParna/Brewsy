// ─────────────────────────────────────────────────────────────────────────────
// THE NEWS SOURCES. Edit this list to add or remove feeds.
//
// Brewsy casts a wide net (≈150 feeds across 14 topics), groups articles about
// the same event, scores each group, and only then narrows down. Each source has:
//
// - `outlet`    What you see in the app (Settings → Sources toggles use it).
//               Several feeds can share one outlet (e.g. BBC World + BBC Business).
// - `category`  What kind of source it is:
//     'wire'        Wire services. They break news first. A wire item flagged
//                   "breaking" makes its story a must-include.
//     'major'       Major newsrooms. Wire + major outlets are the "major outlets"
//                   counted by the must-include rule (5+ of them → always included).
//     'tech'        Tech and AI press, and the tech aggregators.
//     'specialist'  Specialist press for one beat: cars, games, sport, film, TV
//                   and music, crypto, health, climate, science, politics.
//     'official'    Primary sources: company newsrooms, AI lab blogs, the Fed,
//                   SEC filings, the White House. Adds "impact" to a story.
//     'safety-net'  Aggregators (Yahoo News). Each item is credited to its real
//                   publisher (AP, Reuters, AFP…), so they mostly widen the coverage count.
// - `trust`     How much one article from here counts as coverage:
//     'high' ×1.5 (wires, major newsrooms) · 'medium' ×1 (specialist press,
//     official sources) · 'low' ×0.5 (aggregators, community, unknown outlets).
// - `kind`      How to read it:
//     'rss'                a normal RSS/Atom feed
//     'news-sitemap'       a Google-News-style sitemap (Reuters has no public RSS).
//                          Headlines + links only; pages back through the last 24 h.
//     'aggregator'         an RSS feed of other outlets' stories with a <source> per
//                          item (Yahoo News); each item is credited to that outlet.
//     'google-news'        Google News search (site:…). Headlines + links only.
//     'google-news-topic'  Google News topic page. Each item names its publisher and
//                          lists other outlets covering the same story.
//                          Google News (and Bing News) refuse requests from cloud
//                          servers like Supabase's (HTTP 503), so neither is in the
//                          list below; the kinds stay for running the pipeline elsewhere.
//     'html-list'          a news page we read links from (Anthropic has no RSS)
//     'sec-8k'             SEC 8-K filings for the `companies` listed. Needs the
//                          SEC_CONTACT_EMAIL secret (the SEC requires a contact in
//                          the User-Agent); skipped without it.
// - `topicHint` nudges the AI toward a topic; it still decides per story. It also
//   makes sure every topic gets candidates in front of the AI (see pipeline.ts).
//
// Left out on purpose: BLS (blocks automated requests, 403), the US Treasury
// press-release feed (404), and AP's and AFP's own sites (they block cloud
// servers; their stories arrive through Yahoo News instead). Jobs and inflation
// data still arrive through the wires and the major outlets. Also left out after
// checking (Oct 2026): ESPN (serves a web page instead of RSS), Automotive News
// (403), Bloomberg Green (404), the WHO feed and Carbon Brief (no new items for
// days), Space.com and the NYT Sports feed (empty), Formula 1 (no dates).
// Film, checked Oct 2026: Cineuropa (doesn't answer), Box Office Pro and Asian
// Movie Pulse (403), Film Companion (empty feed), Empire (404), BFI, Letterboxd
// Journal, RogerEbert.com, MUBI Notebook and Little White Lies (features and
// reviews, rarely anything inside the 24-hour window), Collider and /Film (mostly
// listicles), NDTV Movies and Hindustan Times' Bollywood feed (mostly celebrity
// gossip). Film and entertainment feeds also skip gossip headlines (feeds.ts).
// Indian Express Entertainment is kept for its Malayalam, Tamil and Telugu film news.
// World cinema, checked Oct 2026: Cineuropa, Asian Movie Pulse, LatAm Cinema, The
// Japan Times, Unifrance, IFTN and the Cannes feed (403 to servers); Film New Europe
// (never answers); Filmmaker Magazine, Screen Africa, Nollywood Reinvented, China Film
// Insider and the Korea JoongAng Daily (stale, gone or no feed); Film Comment (only
// podcasts lately); The Film Verdict, IONCINEMA, Slant and other review sites (reviews,
// not news); Anime News Network (mostly TV anime and manga); and the culture feeds of
// Yonhap, the Korea Herald, Dawn, the Express Tribune, Khaleej Times, Inquirer,
// Philstar, Malay Mail and Premium Times (mostly K-pop, TV or celebrity gossip).
// Spanish, French and Italian feeds are left out: grouping matches English words only.
// Local news, checked Oct 2026: CTV's old feed addresses and CP24 (404), CityNews and the
// Toronto Star (403), the Financial Post (mostly press releases), The Telegraph (402), ITV
// (doesn't answer), Sky's and the Independent's politics feeds (empty), news.com.au and The
// Australian (403 or empty), 9News (404), ABC Australia's politics feed (500), The Age (the
// same stories as the Sydney Morning Herald), NDTV's India feed (mostly exam notices), and
// USA Today, CNN's US feed and AP (empty or 404).
//
// Plain data only: the app imports this file too, so no Deno/npm imports here.
// ─────────────────────────────────────────────────────────────────────────────

// Same names as `Topic` in types.ts (kept literal: the app imports this file too).
export type TopicHint =
  | 'ai' | 'tech' | 'business' | 'world' | 'politics' | 'science' | 'health' | 'climate'
  | 'autos' | 'gaming' | 'sports' | 'entertainment' | 'movies' | 'crypto' | 'mixed';
export type SourceCategory = 'wire' | 'major' | 'tech' | 'specialist' | 'official' | 'safety-net';
export type Trust = 'high' | 'medium' | 'low';

/**
 * Where a reader's local news comes from (onboarding and Settings → News from). The world
 * edition is shared by everyone; each region adds a short local section. WORLD has none.
 * Plain data: the app imports this file too.
 */
export type Region = 'IN' | 'CA' | 'US' | 'UK' | 'AU' | 'WORLD';
export type LocalRegion = Exclude<Region, 'WORLD'>;

/** In picker order. `timeZone` sets when the region's local section is made (05:00 there). */
export const REGIONS: { id: Region; label: string; timeZone: string | null }[] = [
  { id: 'IN', label: 'India', timeZone: 'Asia/Kolkata' },
  { id: 'US', label: 'United States', timeZone: 'America/New_York' },
  { id: 'UK', label: 'United Kingdom', timeZone: 'Europe/London' },
  { id: 'CA', label: 'Canada', timeZone: 'America/Toronto' },
  { id: 'AU', label: 'Australia', timeZone: 'Australia/Sydney' },
  { id: 'WORLD', label: 'Just world news', timeZone: null },
];

export type FeedSource = {
  id: string;
  outlet: string;
  url: string;
  kind: 'rss' | 'news-sitemap' | 'aggregator' | 'google-news' | 'google-news-topic' | 'html-list' | 'sec-8k';
  topicHint: TopicHint;
  category: SourceCategory;
  trust: Trust;
  /** sec-8k only: the companies whose 8-K filings to watch. */
  companies?: { cik: string; name: string }[];
  /** Local news: read only for this region's section, kept out of the world edition. */
  region?: LocalRegion;
};

const bloomberg = (section: string) => `https://feeds.bloomberg.com/${section}/news.rss`;
const nyt = (section: string) => `https://rss.nytimes.com/services/xml/rss/nyt/${section}.xml`;
const bbc = (section: string) => `https://feeds.bbci.co.uk/${section}/rss.xml`;
const guardian = (section: string) => `https://www.theguardian.com/${section}/rss`;
const wsj = (feed: string) => `https://feeds.content.dowjones.io/public/rss/${feed}`;

export const SOURCES: FeedSource[] = [
  // ── Wire services: first to break news (AP and AFP arrive through Yahoo News, below) ──
  { id: 'reuters', outlet: 'Reuters', kind: 'news-sitemap', topicHint: 'mixed', category: 'wire', trust: 'high', url: 'https://www.reuters.com/arc/outboundfeeds/news-sitemap/?outputType=xml' },
  { id: 'bloomberg-markets', outlet: 'Bloomberg', kind: 'rss', topicHint: 'business', category: 'wire', trust: 'high', url: bloomberg('markets') },
  { id: 'bloomberg-economics', outlet: 'Bloomberg', kind: 'rss', topicHint: 'business', category: 'wire', trust: 'high', url: bloomberg('economics') },
  { id: 'bloomberg-politics', outlet: 'Bloomberg', kind: 'rss', topicHint: 'politics', category: 'wire', trust: 'high', url: bloomberg('politics') },
  { id: 'bloomberg-tech', outlet: 'Bloomberg', kind: 'rss', topicHint: 'tech', category: 'wire', trust: 'high', url: bloomberg('technology') },

  // ── Major outlets ──
  { id: 'bbc-world', outlet: 'BBC News', kind: 'rss', topicHint: 'world', category: 'major', trust: 'high', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'bbc-business', outlet: 'BBC News', kind: 'rss', topicHint: 'business', category: 'major', trust: 'high', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { id: 'bbc-tech', outlet: 'BBC News', kind: 'rss', topicHint: 'tech', category: 'major', trust: 'high', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { id: 'npr-news', outlet: 'NPR', kind: 'rss', topicHint: 'world', category: 'major', trust: 'high', url: 'https://feeds.npr.org/1001/rss.xml' },
  { id: 'npr-business', outlet: 'NPR', kind: 'rss', topicHint: 'business', category: 'major', trust: 'high', url: 'https://feeds.npr.org/1006/rss.xml' },
  { id: 'nyt-home', outlet: 'New York Times', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', url: nyt('HomePage') },
  { id: 'nyt-world', outlet: 'New York Times', kind: 'rss', topicHint: 'world', category: 'major', trust: 'high', url: nyt('World') },
  { id: 'nyt-business', outlet: 'New York Times', kind: 'rss', topicHint: 'business', category: 'major', trust: 'high', url: nyt('Business') },
  { id: 'nyt-tech', outlet: 'New York Times', kind: 'rss', topicHint: 'tech', category: 'major', trust: 'high', url: nyt('Technology') },
  { id: 'wsj-world', outlet: 'Wall Street Journal', kind: 'rss', topicHint: 'world', category: 'major', trust: 'high', url: wsj('RSSWorldNews') },
  { id: 'wsj-markets', outlet: 'Wall Street Journal', kind: 'rss', topicHint: 'business', category: 'major', trust: 'high', url: wsj('RSSMarketsMain') },
  { id: 'wsj-tech', outlet: 'Wall Street Journal', kind: 'rss', topicHint: 'tech', category: 'major', trust: 'high', url: wsj('RSSWSJD') },
  { id: 'ft', outlet: 'Financial Times', kind: 'rss', topicHint: 'business', category: 'major', trust: 'high', url: 'https://www.ft.com/rss/home' },
  { id: 'guardian-world', outlet: 'The Guardian', kind: 'rss', topicHint: 'world', category: 'major', trust: 'high', url: 'https://www.theguardian.com/world/rss' },
  { id: 'guardian-business', outlet: 'The Guardian', kind: 'rss', topicHint: 'business', category: 'major', trust: 'high', url: 'https://www.theguardian.com/uk/business/rss' },
  { id: 'guardian-tech', outlet: 'The Guardian', kind: 'rss', topicHint: 'tech', category: 'major', trust: 'high', url: 'https://www.theguardian.com/uk/technology/rss' },
  { id: 'cnbc-top', outlet: 'CNBC', kind: 'rss', topicHint: 'business', category: 'major', trust: 'high', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { id: 'cnbc-tech', outlet: 'CNBC', kind: 'rss', topicHint: 'tech', category: 'major', trust: 'high', url: 'https://www.cnbc.com/id/19854910/device/rss/rss.html' },
  { id: 'axios', outlet: 'Axios', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', url: 'https://api.axios.com/feed/' },
  { id: 'wapo-world', outlet: 'Washington Post', kind: 'rss', topicHint: 'world', category: 'major', trust: 'high', url: 'https://feeds.washingtonpost.com/rss/world' },
  { id: 'nbc', outlet: 'NBC News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', url: 'https://feeds.nbcnews.com/nbcnews/public/news' },
  { id: 'abc', outlet: 'ABC News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', url: 'https://feeds.abcnews.com/abcnews/topstories' },
  { id: 'cbs', outlet: 'CBS News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', url: 'https://www.cbsnews.com/latest/rss/main' },
  { id: 'politico', outlet: 'Politico', kind: 'rss', topicHint: 'politics', category: 'major', trust: 'high', url: 'https://rss.politico.com/politics-news.xml' },
  { id: 'economist', outlet: 'The Economist', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', url: 'https://www.economist.com/latest/rss.xml' },
  { id: 'marketwatch', outlet: 'MarketWatch', kind: 'rss', topicHint: 'business', category: 'major', trust: 'high', url: wsj('mw_topstories') },
  { id: 'aljazeera', outlet: 'Al Jazeera', kind: 'rss', topicHint: 'world', category: 'major', trust: 'high', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'dw', outlet: 'Deutsche Welle', kind: 'rss', topicHint: 'world', category: 'major', trust: 'high', url: 'https://rss.dw.com/rdf/rss-en-all' },
  { id: 'france24', outlet: 'France 24', kind: 'rss', topicHint: 'world', category: 'major', trust: 'high', url: 'https://www.france24.com/en/rss' },
  { id: 'sky-world', outlet: 'Sky News', kind: 'rss', topicHint: 'world', category: 'major', trust: 'high', url: 'https://feeds.skynews.com/feeds/rss/world.xml' },

  // ── Local news: each feeds one region's section only (`region`), never the world edition ──
  // Topic beats stay global even when they come from one country (cricket, Indian film,
  // Autocar India): readers anywhere follow those topics, and a short local section has
  // no room for them.
  // India: national news, mostly politics and policy
  { id: 'hindu-national', outlet: 'The Hindu', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'IN', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { id: 'indian-express', outlet: 'The Indian Express', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'IN', url: 'https://indianexpress.com/section/india/feed/' },
  { id: 'ht-india', outlet: 'Hindustan Times', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'IN', url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml' },
  { id: 'toi-india', outlet: 'The Times of India', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'IN', url: 'https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms' },
  // Canada
  { id: 'cbc-top', outlet: 'CBC News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'CA', url: 'https://www.cbc.ca/webfeed/rss/rss-topstories' },
  { id: 'cbc-canada', outlet: 'CBC News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'CA', url: 'https://www.cbc.ca/webfeed/rss/rss-canada' },
  { id: 'cbc-politics', outlet: 'CBC News', kind: 'rss', topicHint: 'politics', category: 'major', trust: 'high', region: 'CA', url: 'https://www.cbc.ca/webfeed/rss/rss-politics' },
  { id: 'ctv-canada', outlet: 'CTV News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'CA', url: 'https://www.ctvnews.ca/arc/outboundfeeds/rss/category/canada/?outputType=xml' },
  { id: 'ctv-politics', outlet: 'CTV News', kind: 'rss', topicHint: 'politics', category: 'major', trust: 'high', region: 'CA', url: 'https://www.ctvnews.ca/arc/outboundfeeds/rss/category/politics/?outputType=xml' },
  { id: 'global-canada', outlet: 'Global News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'CA', url: 'https://globalnews.ca/canada/feed/' },
  { id: 'global-politics', outlet: 'Global News', kind: 'rss', topicHint: 'politics', category: 'major', trust: 'high', region: 'CA', url: 'https://globalnews.ca/politics/feed/' },
  { id: 'globe-canada', outlet: 'The Globe and Mail', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'CA', url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/canada/' },
  { id: 'globe-politics', outlet: 'The Globe and Mail', kind: 'rss', topicHint: 'politics', category: 'major', trust: 'high', region: 'CA', url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/politics/' },
  { id: 'national-post', outlet: 'National Post', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'CA', url: 'https://nationalpost.com/category/news/canada/feed' },
  // United Kingdom (BBC and Guardian politics stay in the world edition, above)
  { id: 'bbc-uk', outlet: 'BBC News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'UK', url: bbc('news/uk') },
  { id: 'guardian-uk', outlet: 'The Guardian', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'UK', url: guardian('uk-news') },
  { id: 'sky-uk', outlet: 'Sky News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'UK', url: 'https://feeds.skynews.com/feeds/rss/uk.xml' },
  { id: 'independent-uk', outlet: 'The Independent', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'UK', url: 'https://www.independent.co.uk/news/uk/rss' },
  { id: 'inews', outlet: 'The i Paper', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'medium', region: 'UK', url: 'https://inews.co.uk/feed' },
  { id: 'standard-uk', outlet: 'Evening Standard', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'medium', region: 'UK', url: 'https://www.standard.co.uk/news/uk/rss' },
  // Australia
  { id: 'abc-au', outlet: 'ABC Australia', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'AU', url: 'https://www.abc.net.au/news/feed/51120/rss.xml' },
  { id: 'abc-au-latest', outlet: 'ABC Australia', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'AU', url: 'https://www.abc.net.au/news/feed/45910/rss.xml' },
  { id: 'smh-national', outlet: 'The Sydney Morning Herald', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'AU', url: 'https://www.smh.com.au/rss/national.xml' },
  { id: 'smh-politics', outlet: 'The Sydney Morning Herald', kind: 'rss', topicHint: 'politics', category: 'major', trust: 'high', region: 'AU', url: 'https://www.smh.com.au/rss/politics/federal.xml' },
  { id: 'guardian-au', outlet: 'Guardian Australia', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'AU', url: guardian('australia-news') },
  { id: 'sbs', outlet: 'SBS News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'AU', url: 'https://www.sbs.com.au/news/topic/latest/feed' },
  { id: 'afr', outlet: 'Australian Financial Review', kind: 'rss', topicHint: 'business', category: 'major', trust: 'high', region: 'AU', url: 'https://www.afr.com/rss/feed.xml' },
  // United States: the world edition already reads most US newsrooms; these are their national desks
  { id: 'nyt-us', outlet: 'New York Times', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'US', url: nyt('US') },
  { id: 'npr-national', outlet: 'NPR', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'US', url: 'https://feeds.npr.org/1003/rss.xml' },
  { id: 'cbs-us', outlet: 'CBS News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'US', url: 'https://www.cbsnews.com/latest/rss/us' },
  { id: 'abc-us', outlet: 'ABC News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'US', url: 'https://abcnews.go.com/abcnews/usheadlines' },
  { id: 'pbs-nation', outlet: 'PBS News', kind: 'rss', topicHint: 'mixed', category: 'major', trust: 'high', region: 'US', url: 'https://www.pbs.org/newshour/feeds/rss/nation' },

  // ── Major outlets, by beat ──
  // Politics
  { id: 'nyt-politics', outlet: 'New York Times', kind: 'rss', topicHint: 'politics', category: 'major', trust: 'high', url: nyt('Politics') },
  { id: 'npr-politics', outlet: 'NPR', kind: 'rss', topicHint: 'politics', category: 'major', trust: 'high', url: 'https://feeds.npr.org/1014/rss.xml' },
  { id: 'bbc-politics', outlet: 'BBC News', kind: 'rss', topicHint: 'politics', category: 'major', trust: 'high', url: bbc('news/politics') },
  { id: 'guardian-politics', outlet: 'The Guardian', kind: 'rss', topicHint: 'politics', category: 'major', trust: 'high', url: guardian('politics') },
  // Science
  { id: 'nyt-science', outlet: 'New York Times', kind: 'rss', topicHint: 'science', category: 'major', trust: 'high', url: nyt('Science') },
  { id: 'bbc-science', outlet: 'BBC News', kind: 'rss', topicHint: 'science', category: 'major', trust: 'high', url: bbc('news/science_and_environment') },
  { id: 'guardian-science', outlet: 'The Guardian', kind: 'rss', topicHint: 'science', category: 'major', trust: 'high', url: guardian('science') },
  // Health
  { id: 'nyt-health', outlet: 'New York Times', kind: 'rss', topicHint: 'health', category: 'major', trust: 'high', url: nyt('Health') },
  { id: 'bbc-health', outlet: 'BBC News', kind: 'rss', topicHint: 'health', category: 'major', trust: 'high', url: bbc('news/health') },
  { id: 'npr-health', outlet: 'NPR', kind: 'rss', topicHint: 'health', category: 'major', trust: 'high', url: 'https://feeds.npr.org/1128/rss.xml' },
  { id: 'guardian-health', outlet: 'The Guardian', kind: 'rss', topicHint: 'health', category: 'major', trust: 'high', url: guardian('society/health') },
  // Climate
  { id: 'nyt-climate', outlet: 'New York Times', kind: 'rss', topicHint: 'climate', category: 'major', trust: 'high', url: nyt('Climate') },
  { id: 'guardian-environment', outlet: 'The Guardian', kind: 'rss', topicHint: 'climate', category: 'major', trust: 'high', url: guardian('environment') },
  // Sport
  { id: 'bbc-sport', outlet: 'BBC News', kind: 'rss', topicHint: 'sports', category: 'major', trust: 'high', url: bbc('sport') },
  { id: 'guardian-sport', outlet: 'The Guardian', kind: 'rss', topicHint: 'sports', category: 'major', trust: 'high', url: guardian('uk/sport') },
  // TV, music and the arts (their film coverage arrives through the movie feeds below too)
  { id: 'nyt-arts', outlet: 'New York Times', kind: 'rss', topicHint: 'entertainment', category: 'major', trust: 'high', url: nyt('Arts') },
  { id: 'bbc-entertainment', outlet: 'BBC News', kind: 'rss', topicHint: 'entertainment', category: 'major', trust: 'high', url: bbc('news/entertainment_and_arts') },
  { id: 'guardian-culture', outlet: 'The Guardian', kind: 'rss', topicHint: 'entertainment', category: 'major', trust: 'high', url: guardian('culture') },
  // Film: Indian newsrooms' cinema desks (Bollywood and the regional film industries)
  { id: 'hindu-movies', outlet: 'The Hindu', kind: 'rss', topicHint: 'movies', category: 'major', trust: 'high', url: 'https://www.thehindu.com/entertainment/movies/feeder/default.rss' },
  { id: 'indian-express-entertainment', outlet: 'The Indian Express', kind: 'rss', topicHint: 'movies', category: 'major', trust: 'high', url: 'https://indianexpress.com/section/entertainment/feed/' },
  { id: 'ht-tamil-cinema', outlet: 'Hindustan Times', kind: 'rss', topicHint: 'movies', category: 'major', trust: 'high', url: 'https://www.hindustantimes.com/feeds/rss/entertainment/tamil-cinema/rssfeed.xml' },
  { id: 'ht-telugu-cinema', outlet: 'Hindustan Times', kind: 'rss', topicHint: 'movies', category: 'major', trust: 'high', url: 'https://www.hindustantimes.com/feeds/rss/entertainment/telugu-cinema/rssfeed.xml' },
  // Film: other newsrooms' film desks (British and world cinema; Hong Kong, Chinese, Japanese and Korean film)
  { id: 'guardian-film', outlet: 'The Guardian', kind: 'rss', topicHint: 'movies', category: 'major', trust: 'high', url: guardian('film') },
  { id: 'scmp-film', outlet: 'South China Morning Post', kind: 'rss', topicHint: 'movies', category: 'major', trust: 'high', url: 'https://www.scmp.com/rss/318254/feed' },

  // ── Tech and AI ──
  { id: 'verge', outlet: 'The Verge', kind: 'rss', topicHint: 'tech', category: 'tech', trust: 'medium', url: 'https://www.theverge.com/rss/index.xml' },
  { id: 'techcrunch', outlet: 'TechCrunch', kind: 'rss', topicHint: 'tech', category: 'tech', trust: 'medium', url: 'https://techcrunch.com/feed/' },
  { id: 'ars', outlet: 'Ars Technica', kind: 'rss', topicHint: 'tech', category: 'tech', trust: 'medium', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { id: 'wired', outlet: 'Wired', kind: 'rss', topicHint: 'tech', category: 'tech', trust: 'medium', url: 'https://www.wired.com/feed/rss' },
  { id: 'mittr', outlet: 'MIT Technology Review', kind: 'rss', topicHint: 'ai', category: 'tech', trust: 'medium', url: 'https://www.technologyreview.com/feed/' },
  { id: '404media', outlet: '404 Media', kind: 'rss', topicHint: 'tech', category: 'tech', trust: 'medium', url: 'https://www.404media.co/rss/' },
  // Aggregators: great at "what is everyone covering", so they count, but lightly.
  { id: 'techmeme', outlet: 'Techmeme', kind: 'rss', topicHint: 'tech', category: 'tech', trust: 'low', url: 'https://www.techmeme.com/feed.xml' },
  { id: 'hn', outlet: 'Hacker News', kind: 'rss', topicHint: 'tech', category: 'tech', trust: 'low', url: 'https://hnrss.org/frontpage?points=150' },

  // ── Specialist press, one beat each ──
  // Politics
  { id: 'the-hill', outlet: 'The Hill', kind: 'rss', topicHint: 'politics', category: 'specialist', trust: 'medium', url: 'https://thehill.com/homenews/feed/' },
  // Science and space
  { id: 'new-scientist', outlet: 'New Scientist', kind: 'rss', topicHint: 'science', category: 'specialist', trust: 'medium', url: 'https://www.newscientist.com/feed/home/' },
  { id: 'science-news', outlet: 'Science', kind: 'rss', topicHint: 'science', category: 'specialist', trust: 'medium', url: 'https://www.science.org/rss/news_current.xml' },
  { id: 'nature', outlet: 'Nature', kind: 'rss', topicHint: 'science', category: 'specialist', trust: 'medium', url: 'https://www.nature.com/nature.rss' },
  { id: 'phys-org', outlet: 'Phys.org', kind: 'rss', topicHint: 'science', category: 'specialist', trust: 'low', url: 'https://phys.org/rss-feed/' },
  // Health
  { id: 'stat', outlet: 'STAT', kind: 'rss', topicHint: 'health', category: 'specialist', trust: 'medium', url: 'https://www.statnews.com/feed/' },
  // Climate and energy
  { id: 'inside-climate', outlet: 'Inside Climate News', kind: 'rss', topicHint: 'climate', category: 'specialist', trust: 'medium', url: 'https://insideclimatenews.org/feed/' },
  { id: 'grist', outlet: 'Grist', kind: 'rss', topicHint: 'climate', category: 'specialist', trust: 'medium', url: 'https://grist.org/feed/' },
  { id: 'yale-e360', outlet: 'Yale Environment 360', kind: 'rss', topicHint: 'climate', category: 'specialist', trust: 'medium', url: 'https://e360.yale.edu/feed.xml' },
  // Cars and EVs
  { id: 'electrek', outlet: 'Electrek', kind: 'rss', topicHint: 'autos', category: 'specialist', trust: 'medium', url: 'https://electrek.co/feed/' },
  { id: 'insideevs', outlet: 'InsideEVs', kind: 'rss', topicHint: 'autos', category: 'specialist', trust: 'medium', url: 'https://insideevs.com/rss/news/all/' },
  { id: 'autocar', outlet: 'Autocar', kind: 'rss', topicHint: 'autos', category: 'specialist', trust: 'medium', url: 'https://www.autocar.co.uk/rss' },
  { id: 'car-and-driver', outlet: 'Car and Driver', kind: 'rss', topicHint: 'autos', category: 'specialist', trust: 'medium', url: 'https://www.caranddriver.com/rss/all.xml/' },
  { id: 'motor1', outlet: 'Motor1', kind: 'rss', topicHint: 'autos', category: 'specialist', trust: 'medium', url: 'https://www.motor1.com/rss/news/all/' },
  { id: 'autocar-india', outlet: 'Autocar India', kind: 'rss', topicHint: 'autos', category: 'specialist', trust: 'medium', url: 'https://www.autocarindia.com/rss/all' },
  { id: 'verge-transport', outlet: 'The Verge', kind: 'rss', topicHint: 'autos', category: 'tech', trust: 'medium', url: 'https://www.theverge.com/rss/transportation/index.xml' },
  // Games
  { id: 'polygon', outlet: 'Polygon', kind: 'rss', topicHint: 'gaming', category: 'specialist', trust: 'medium', url: 'https://www.polygon.com/rss/index.xml' },
  { id: 'ign', outlet: 'IGN', kind: 'rss', topicHint: 'gaming', category: 'specialist', trust: 'medium', url: 'https://feeds.ign.com/ign/all' },
  { id: 'eurogamer', outlet: 'Eurogamer', kind: 'rss', topicHint: 'gaming', category: 'specialist', trust: 'medium', url: 'https://www.eurogamer.net/feed' },
  { id: 'gamesindustry', outlet: 'GamesIndustry.biz', kind: 'rss', topicHint: 'gaming', category: 'specialist', trust: 'medium', url: 'https://www.gamesindustry.biz/feed' },
  { id: 'kotaku', outlet: 'Kotaku', kind: 'rss', topicHint: 'gaming', category: 'specialist', trust: 'medium', url: 'https://kotaku.com/rss' },
  { id: 'pc-gamer', outlet: 'PC Gamer', kind: 'rss', topicHint: 'gaming', category: 'specialist', trust: 'medium', url: 'https://www.pcgamer.com/rss/' },
  { id: 'verge-games', outlet: 'The Verge', kind: 'rss', topicHint: 'gaming', category: 'tech', trust: 'medium', url: 'https://www.theverge.com/rss/games/index.xml' },
  // Sport (cricket first: the reader is in India)
  { id: 'espncricinfo', outlet: 'ESPNcricinfo', kind: 'rss', topicHint: 'sports', category: 'specialist', trust: 'medium', url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml' },
  { id: 'sky-sports', outlet: 'Sky Sports', kind: 'rss', topicHint: 'sports', category: 'specialist', trust: 'medium', url: 'https://www.skysports.com/rss/12040' },
  { id: 'cbs-sports', outlet: 'CBS Sports', kind: 'rss', topicHint: 'sports', category: 'specialist', trust: 'medium', url: 'https://www.cbssports.com/rss/headlines/' },
  { id: 'motorsport', outlet: 'Motorsport.com', kind: 'rss', topicHint: 'sports', category: 'specialist', trust: 'medium', url: 'https://www.motorsport.com/rss/f1/news/' },
  // TV, music and the entertainment industry (the trades' film desks are under Film, below)
  { id: 'variety', outlet: 'Variety', kind: 'rss', topicHint: 'entertainment', category: 'specialist', trust: 'medium', url: 'https://variety.com/feed/' },
  { id: 'hollywood-reporter', outlet: 'The Hollywood Reporter', kind: 'rss', topicHint: 'entertainment', category: 'specialist', trust: 'medium', url: 'https://www.hollywoodreporter.com/feed/' },
  { id: 'deadline', outlet: 'Deadline', kind: 'rss', topicHint: 'entertainment', category: 'specialist', trust: 'medium', url: 'https://deadline.com/feed/' },
  { id: 'billboard', outlet: 'Billboard', kind: 'rss', topicHint: 'entertainment', category: 'specialist', trust: 'medium', url: 'https://www.billboard.com/feed/' },
  // Film. Hollywood trades: releases, box office, casting, deals, festivals
  { id: 'variety-film', outlet: 'Variety', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://variety.com/v/film/feed/' },
  { id: 'deadline-film', outlet: 'Deadline', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://deadline.com/v/film/feed/' },
  { id: 'hollywood-reporter-movies', outlet: 'The Hollywood Reporter', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://www.hollywoodreporter.com/c/movies/feed/' },
  { id: 'indiewire', outlet: 'IndieWire', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://www.indiewire.com/feed/' },
  // The trades' international desks: Asian box office and festivals (Variety Global), Europe,
  // Latin America and the Middle East (Variety's global section), sales and co-productions (Deadline)
  { id: 'variety-global', outlet: 'Variety', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://variety.com/v/global/feed/' },
  { id: 'variety-international', outlet: 'Variety', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://variety.com/c/global/feed/' },
  { id: 'deadline-international', outlet: 'Deadline', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://deadline.com/v/international/feed/' },
  // World cinema, festivals and independent film
  { id: 'screen-daily', outlet: 'Screen Daily', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://www.screendaily.com/45202.rss' },
  { id: 'the-playlist', outlet: 'The Playlist', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://theplaylist.net/feed/' },
  { id: 'film-stage', outlet: 'The Film Stage', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://thefilmstage.com/feed/' },
  { id: 'world-of-reel', outlet: 'World of Reel', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'low', url: 'https://www.worldofreel.com/blog?format=rss' },
  // Genre and world cinema news (its feeds are http only)
  { id: 'screen-anarchy', outlet: 'ScreenAnarchy', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'low', url: 'http://feeds.screenanarchy.com/sa-news' },
  // Indian cinema: Bollywood, the South Indian industries, box office
  { id: 'bollywood-hungama', outlet: 'Bollywood Hungama', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://www.bollywoodhungama.com/feed/' },
  { id: 'cinema-express', outlet: 'Cinema Express', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://www.cinemaexpress.com/stories.rss' },
  { id: 'koimoi', outlet: 'Koimoi', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'low', url: 'https://www.koimoi.com/feed/' },
  { id: 'onmanorama-movies', outlet: 'Onmanorama', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://www.onmanorama.com/entertainment.feeds.onmrss.xml' },
  // East and Southeast Asia: Hong Kong and Asian action cinema, Philippine film
  { id: 'city-on-fire', outlet: 'City On Fire', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'low', url: 'https://cityonfire.com/feed/' },
  { id: 'rappler-movies', outlet: 'Rappler', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://www.rappler.com/entertainment/movies/feed/' },
  // Middle East and Turkey (a newsroom we don't otherwise read counts as film press)
  { id: 'the-national-film', outlet: 'The National', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://www.thenationalnews.com/arc/outboundfeeds/rss/category/arts-culture/film-tv/?outputType=xml' },
  { id: 'daily-sabah-cinema', outlet: 'Daily Sabah', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://www.dailysabah.com/rss/arts/cinema' },
  // Africa: African film criticism and news, Nollywood, East African and South African film
  { id: 'afrocritik', outlet: 'Afrocritik', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://afrocritik.com/feed/' },
  { id: 'nollycritic', outlet: 'Nollycritic', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'low', url: 'https://nollycritic.com/feed/' },
  { id: 'sinema-focus', outlet: 'Sinema Focus', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'low', url: 'https://sinemafocus.com/feed/' },
  { id: 'bizcommunity-film', outlet: 'Bizcommunity', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'low', url: 'https://www.bizcommunity.com/rss/196/482.html' },
  // Europe, Australia and Canada: Italian film (English edition), the Australian and Canadian screen trades
  { id: 'cinecitta-news', outlet: 'Cinecittà News', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://cinecittanews.it/en/feed/' },
  { id: 'if-magazine', outlet: 'IF Magazine', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://if.com.au/feed/' },
  { id: 'playback', outlet: 'Playback', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://playbackonline.ca/feed/' },
  // Animation and documentary
  { id: 'cartoon-brew', outlet: 'Cartoon Brew', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://www.cartoonbrew.com/feed' },
  { id: 'animation-magazine', outlet: 'Animation Magazine', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://www.animationmagazine.net/feed/' },
  { id: 'pov-magazine', outlet: 'POV Magazine', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://povmagazine.com/feed/' },
  { id: 'business-doc-europe', outlet: 'Business Doc Europe', kind: 'rss', topicHint: 'movies', category: 'specialist', trust: 'medium', url: 'https://businessdoceurope.com/feed/' },
  // Crypto
  { id: 'coindesk', outlet: 'CoinDesk', kind: 'rss', topicHint: 'crypto', category: 'specialist', trust: 'medium', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { id: 'the-block', outlet: 'The Block', kind: 'rss', topicHint: 'crypto', category: 'specialist', trust: 'medium', url: 'https://www.theblock.co/rss.xml' },
  { id: 'decrypt', outlet: 'Decrypt', kind: 'rss', topicHint: 'crypto', category: 'specialist', trust: 'medium', url: 'https://decrypt.co/feed' },
  { id: 'cointelegraph', outlet: 'Cointelegraph', kind: 'rss', topicHint: 'crypto', category: 'specialist', trust: 'low', url: 'https://cointelegraph.com/rss' },

  // ── Official sources ──
  { id: 'openai', outlet: 'OpenAI', kind: 'rss', topicHint: 'ai', category: 'official', trust: 'medium', url: 'https://openai.com/news/rss.xml' },
  { id: 'anthropic', outlet: 'Anthropic', kind: 'html-list', topicHint: 'ai', category: 'official', trust: 'medium', url: 'https://www.anthropic.com/news' },
  { id: 'google-ai', outlet: 'Google', kind: 'rss', topicHint: 'ai', category: 'official', trust: 'medium', url: 'https://blog.google/technology/ai/rss/' },
  { id: 'deepmind', outlet: 'Google DeepMind', kind: 'rss', topicHint: 'ai', category: 'official', trust: 'medium', url: 'https://deepmind.google/blog/rss.xml' },
  { id: 'meta', outlet: 'Meta', kind: 'rss', topicHint: 'ai', category: 'official', trust: 'medium', url: 'https://about.fb.com/news/feed/' },
  { id: 'microsoft', outlet: 'Microsoft', kind: 'rss', topicHint: 'ai', category: 'official', trust: 'medium', url: 'https://blogs.microsoft.com/feed/' },
  { id: 'nvidia', outlet: 'Nvidia', kind: 'rss', topicHint: 'ai', category: 'official', trust: 'medium', url: 'https://blogs.nvidia.com/feed/' },
  { id: 'nvidia-news', outlet: 'Nvidia', kind: 'rss', topicHint: 'ai', category: 'official', trust: 'medium', url: 'https://nvidianews.nvidia.com/releases.xml' },
  { id: 'apple', outlet: 'Apple', kind: 'rss', topicHint: 'tech', category: 'official', trust: 'medium', url: 'https://www.apple.com/newsroom/rss-feed.rss' },
  { id: 'fed', outlet: 'Federal Reserve', kind: 'rss', topicHint: 'business', category: 'official', trust: 'medium', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
  { id: 'whitehouse', outlet: 'White House', kind: 'rss', topicHint: 'politics', category: 'official', trust: 'medium', url: 'https://www.whitehouse.gov/news/feed/' },
  { id: 'nasa', outlet: 'NASA', kind: 'rss', topicHint: 'science', category: 'official', trust: 'medium', url: 'https://www.nasa.gov/news-release/feed/' },
  {
    id: 'sec-8k', outlet: 'SEC filings', kind: 'sec-8k', topicHint: 'business', category: 'official', trust: 'medium',
    url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=8-K&dateb=&owner=include&count=5&output=atom',
    // The largest US-listed companies. Add any company by its CIK (search on sec.gov/edgar).
    companies: [
      { cik: '0000320193', name: 'Apple' },
      { cik: '0000789019', name: 'Microsoft' },
      { cik: '0001045810', name: 'Nvidia' },
      { cik: '0001652044', name: 'Alphabet' },
      { cik: '0001018724', name: 'Amazon' },
      { cik: '0001326801', name: 'Meta' },
      { cik: '0001067983', name: 'Berkshire Hathaway' },
      { cik: '0001318605', name: 'Tesla' },
      { cik: '0001730168', name: 'Broadcom' },
      { cik: '0000019617', name: 'JPMorgan Chase' },
      { cik: '0000059478', name: 'Eli Lilly' },
      { cik: '0001403161', name: 'Visa' },
      { cik: '0000104169', name: 'Walmart' },
      { cik: '0000034088', name: 'Exxon Mobil' },
      { cik: '0001141391', name: 'Mastercard' },
      { cik: '0001341439', name: 'Oracle' },
      { cik: '0001065280', name: 'Netflix' },
      { cik: '0000002488', name: 'AMD' },
      { cik: '0001321655', name: 'Palantir' },
      { cik: '0000070858', name: 'Bank of America' },
    ],
  },

  // ── Safety net: Yahoo News republishes AP, Reuters, AFP and others; each item is credited to them ──
  { id: 'yahoo', outlet: 'Yahoo News', kind: 'aggregator', topicHint: 'mixed', category: 'safety-net', trust: 'low', url: 'https://news.yahoo.com/rss/' },
];

/** Wire services we don't fetch directly; their stories arrive through Yahoo News. */
export const OTHER_WIRES: string[] = ['AP News', 'AFP'];

/**
 * Well-known newsrooms we don't fetch directly but may see credited in an
 * aggregator. They count as major outlets for the must-include rule.
 */
export const OTHER_MAJOR_OUTLETS: string[] = [
  'CNN', 'Washington Post', 'Los Angeles Times', 'Politico', 'The Economist', 'Al Jazeera', 'ABC News',
  'CBS News', 'NBC News', 'Fox News', 'Time', 'USA Today', 'Sky News', 'The Times', 'The Telegraph',
  'Nikkei Asia', 'South China Morning Post', 'Deutsche Welle', 'France 24', 'The Hindu', 'Hindustan Times',
  'The Times of India', 'Barron\'s', 'MarketWatch', 'Forbes', 'Fortune', 'Business Insider', 'The Independent',
  'The Indian Express', 'NDTV', 'ESPN', 'The Athletic', 'Toronto Star', 'The Age', 'The Australian', 'ITV News',
];

/**
 * Publisher names as Google News writes them → our outlet names, so the same
 * newsroom is counted once. Keys are lower-cased.
 */
export const OUTLET_ALIASES: Record<string, string> = {
  'reuters': 'Reuters',
  'the associated press': 'AP News',
  'associated press': 'AP News',
  'ap news': 'AP News',
  'afp': 'AFP',
  'agence france-presse': 'AFP',
  'agence france presse': 'AFP',
  'bloomberg': 'Bloomberg',
  'bloomberg.com': 'Bloomberg',
  'bbc': 'BBC News',
  'bbc.com': 'BBC News',
  'bbc news': 'BBC News',
  'npr': 'NPR',
  'the new york times': 'New York Times',
  'new york times': 'New York Times',
  'nytimes.com': 'New York Times',
  'the wall street journal': 'Wall Street Journal',
  'wall street journal': 'Wall Street Journal',
  'wsj': 'Wall Street Journal',
  'financial times': 'Financial Times',
  'ft.com': 'Financial Times',
  'the guardian': 'The Guardian',
  'guardian': 'The Guardian',
  'cnbc': 'CNBC',
  'axios': 'Axios',
  'the verge': 'The Verge',
  'techcrunch': 'TechCrunch',
  'ars technica': 'Ars Technica',
  'wired': 'Wired',
  'mit technology review': 'MIT Technology Review',
  '404 media': '404 Media',
  'cnn': 'CNN',
  'the washington post': 'Washington Post',
  'washington post': 'Washington Post',
  'los angeles times': 'Los Angeles Times',
  'politico': 'Politico',
  'the economist': 'The Economist',
  'al jazeera': 'Al Jazeera',
  'abc news': 'ABC News',
  'cbs news': 'CBS News',
  'nbc news': 'NBC News',
  'fox news': 'Fox News',
  'time': 'Time',
  'time magazine': 'Time',
  'usa today': 'USA Today',
  'sky news': 'Sky News',
  'the times': 'The Times',
  'the telegraph': 'The Telegraph',
  'nikkei asia': 'Nikkei Asia',
  'south china morning post': 'South China Morning Post',
  'dw': 'Deutsche Welle',
  'dw.com': 'Deutsche Welle',
  'deutsche welle': 'Deutsche Welle',
  'france 24': 'France 24',
  'the hindu': 'The Hindu',
  'hindustan times': 'Hindustan Times',
  'the times of india': 'The Times of India',
  'times of india': 'The Times of India',
  "barron's": "Barron's",
  'marketwatch': 'MarketWatch',
  'forbes': 'Forbes',
  'fortune': 'Fortune',
  'business insider': 'Business Insider',
  'the independent': 'The Independent',
  'the indian express': 'The Indian Express',
  'indian express': 'The Indian Express',
  'ndtv': 'NDTV',
  'espn': 'ESPN',
  'espncricinfo': 'ESPNcricinfo',
  'the athletic': 'The Athletic',
  'sky sports': 'Sky Sports',
  'cbs sports': 'CBS Sports',
  'the hill': 'The Hill',
  'new scientist': 'New Scientist',
  'stat': 'STAT',
  'stat news': 'STAT',
  'variety': 'Variety',
  'the hollywood reporter': 'The Hollywood Reporter',
  'hollywood reporter': 'The Hollywood Reporter',
  'deadline': 'Deadline',
  'billboard': 'Billboard',
  'indiewire': 'IndieWire',
  'screen daily': 'Screen Daily',
  'screen international': 'Screen Daily',
  'the playlist': 'The Playlist',
  'the film stage': 'The Film Stage',
  'world of reel': 'World of Reel',
  'bollywood hungama': 'Bollywood Hungama',
  'bollywoodhungama.com': 'Bollywood Hungama',
  'cinema express': 'Cinema Express',
  'koimoi': 'Koimoi',
  'koimoi.com': 'Koimoi',
  'scmp': 'South China Morning Post',
  'onmanorama': 'Onmanorama',
  'screenanarchy': 'ScreenAnarchy',
  'screen anarchy': 'ScreenAnarchy',
  'city on fire': 'City On Fire',
  'rappler': 'Rappler',
  'the national news': 'The National',
  'daily sabah': 'Daily Sabah',
  'afrocritik': 'Afrocritik',
  'nollycritic': 'Nollycritic',
  'sinema focus': 'Sinema Focus',
  'bizcommunity': 'Bizcommunity',
  'cinecittà news': 'Cinecittà News',
  'cinecitta news': 'Cinecittà News',
  'if magazine': 'IF Magazine',
  'playback': 'Playback',
  'cartoon brew': 'Cartoon Brew',
  'animation magazine': 'Animation Magazine',
  'pov magazine': 'POV Magazine',
  'business doc europe': 'Business Doc Europe',
  'coindesk': 'CoinDesk',
  'the block': 'The Block',
  'decrypt': 'Decrypt',
  'cointelegraph': 'Cointelegraph',
  'ign': 'IGN',
  'polygon': 'Polygon',
  'eurogamer': 'Eurogamer',
  'kotaku': 'Kotaku',
  'pc gamer': 'PC Gamer',
  'electrek': 'Electrek',
  'insideevs': 'InsideEVs',
  'autocar': 'Autocar',
  'car and driver': 'Car and Driver',
  'motor1': 'Motor1',
  'motor1.com': 'Motor1',
  'cbc': 'CBC News',
  'cbc news': 'CBC News',
  'cbc.ca': 'CBC News',
  'ctv news': 'CTV News',
  'ctvnews.ca': 'CTV News',
  'global news': 'Global News',
  'the globe and mail': 'The Globe and Mail',
  'globe and mail': 'The Globe and Mail',
  'national post': 'National Post',
  'toronto star': 'Toronto Star',
  'the i paper': 'The i Paper',
  'inews': 'The i Paper',
  'i news': 'The i Paper',
  'evening standard': 'Evening Standard',
  'the standard': 'Evening Standard',
  'itv news': 'ITV News',
  'abc australia': 'ABC Australia',
  'abc news (australia)': 'ABC Australia',
  'abc (australian broadcasting corporation)': 'ABC Australia',
  'the sydney morning herald': 'The Sydney Morning Herald',
  'sydney morning herald': 'The Sydney Morning Herald',
  'the age': 'The Age',
  'the australian': 'The Australian',
  'guardian australia': 'Guardian Australia',
  'sbs news': 'SBS News',
  'sbs': 'SBS News',
  'australian financial review': 'Australian Financial Review',
  'the australian financial review': 'Australian Financial Review',
  'afr': 'Australian Financial Review',
  'pbs news': 'PBS News',
  'pbs newshour': 'PBS News',
};

/** Canonical outlet name for a publisher name from any feed. */
export function normalizeOutlet(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  return OUTLET_ALIASES[clean.toLowerCase()] ?? clean;
}

export type OutletInfo = { category: SourceCategory; trust: Trust };

const OUTLET_INFO: Map<string, OutletInfo> = (() => {
  const m = new Map<string, OutletInfo>();
  for (const s of SOURCES) {
    if (s.category !== 'safety-net' && !m.has(s.outlet)) m.set(s.outlet, { category: s.category, trust: s.trust });
  }
  for (const o of OTHER_WIRES) if (!m.has(o)) m.set(o, { category: 'wire', trust: 'high' });
  for (const o of OTHER_MAJOR_OUTLETS) if (!m.has(o)) m.set(o, { category: 'major', trust: 'high' });
  return m;
})();

/** Category and trust for an outlet; publishers we don't know count as low-trust safety net. */
export function outletInfo(outlet: string): OutletInfo {
  return OUTLET_INFO.get(normalizeOutlet(outlet)) ?? { category: 'safety-net', trust: 'low' };
}

/** Wire services and major newsrooms: the outlets the must-include rule counts. */
export function isMajorOutlet(outlet: string): boolean {
  const { category } = outletInfo(outlet);
  return category === 'wire' || category === 'major';
}

/** Unique outlet names, in list order (one Settings toggle each). */
export const OUTLETS: string[] = [...new Set(SOURCES.map((s) => s.outlet))];

/** Outlets that only feed one region's local section (Settings shows them to that region's readers). */
export const OUTLET_REGION: Record<string, LocalRegion> = Object.fromEntries(
  SOURCES.flatMap((s) =>
    s.region && SOURCES.every((o) => o.outlet !== s.outlet || o.region === s.region) ? [[s.outlet, s.region]] : [],
  ),
);

export const CATEGORY_LABEL: Record<SourceCategory, string> = {
  wire: 'Wire services',
  major: 'Major outlets',
  tech: 'Tech & AI',
  specialist: 'Specialist press',
  official: 'Official sources',
  'safety-net': 'Safety net',
};

/** Outlets grouped by category, in display order (for the Settings screen). */
export const SOURCE_GROUPS: { category: SourceCategory; label: string; outlets: string[] }[] = (
  ['wire', 'major', 'tech', 'specialist', 'official', 'safety-net'] as SourceCategory[]
).map((category) => ({
  category,
  label: CATEGORY_LABEL[category],
  outlets: [...new Set(SOURCES.filter((s) => s.category === category).map((s) => s.outlet))],
}));
