# Brewsy ☀️

Your news, brewed overnight. One calm edition every morning: the stories that matter in the
topics you pick (AI, tech, business, world, politics, science, health, climate, cars, gaming,
sports, entertainment and crypto), explained simply, with as much depth as you want.

- **Today** — the whole edition in one scroll. Swipe left/right (or the Today/Yesterday
  switch) to change day; the calendar opens older editions.
  Each story has three layers: the short version → **Learn more** (explained simply,
  background, key players, key terms, what to watch, all sources) → **Go deeper** (a longer
  explainer written from the story's sources) plus **Ask a question about this**.
- **Reading List** — tap a bookmark to save a story for Tonight / This weekend / Later this
  week / No rush (long-press saves it for no rush). Gentle reminders, never more than one a day.
- **Listen** — **▶ Listen · 8 min** under the date plays the edition as a radio-style
  briefing: Quick (~3 min) or Full (~10 min), one chapter per story. A mini player sits above
  the tab bar; tap it for chapters, speed (0.8×–2×), offline download and **Driving mode**
  (huge buttons, screen stays on). Every story has a small ▶ to start from it, and the
  Reading List has **Play my reading list**. Plays with the screen locked in an installed build.
- **Never miss the big one** — ~110 sources (wires, major outlets, tech/AI, specialist press for
  each beat, official sources, Yahoo News as a safety net), grouped and scored; anything 5+ major
  outlets cover is always in, and every topic with real news gets at least one full story. Below the
  stories, **Also happening** lists the rest of every beat in one line each. During the day Brewsy checks
  every 2 hours and adds **Since this morning** at the top, with an optional breaking-news push
  (at most 2 a day). **How this briefing was made** at the bottom shows what was scanned.
- **Settings** — the gear on Today: theme, wake-up time, topics, breaking news, listening,
  sources, reminders, PDF export, past editions.
- **Themes** — nine complete looks, each with its own typefaces, shapes and layout:
  **Dune** (sand, thin wide-set capitals, sharp corners, centered), **Space** (black, monospace
  details, topic sections open on photo cards), **Atlantis** (deep-blue gradient, serif, round
  frosted cards), **Highlands** (forest tiles, bold italics), **Alpine** (white, Swiss red),
  **Matrix** (falling code, monospace, sections open on a `> prompt_`), **Tron** (the Grid,
  cyan light lines, circuit-trace section titles), **Blade Runner** (amber haze, frosted panels,
  neon pink) and **Budapest** (pastel pink, serif and spaced capitals, double-bordered cards).
  Defined in `src/theme/themes.ts`; covers in `assets/themes/` (photo credits in Settings →
  Theme; the Matrix, Tron and Blade Runner covers are original art).

## Run it

```bash
npm install
npx expo start          # scan the QR code with Expo Go on your phone
```

Without a backend the app shows a bundled sample edition (7 Oct 2026), so you can try
everything except Go deeper / Ask, the studio-voice audio (the phone's voice reads it instead)
and the notifications.

Expo Go can't play audio with the screen locked, show lock-screen controls, receive pushes
on Android or add home-screen shortcuts. For those, install a build:
[docs/ANDROID_BUILD.md](docs/ANDROID_BUILD.md) (it also says how to test them).

## The backend

Supabase (free plan) + Claude (or Gemini's free tier) to write the edition + OpenAI or
ElevenLabs for the studio voice. Costs and setup: [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md).
Pushes and lock-screen audio need an installed build: [docs/ANDROID_BUILD.md](docs/ANDROID_BUILD.md).

## Where things are

```
src/app/            screens: onboarding, (tabs)/index = Today, (tabs)/reading-list
src/components/     UI pieces (StoryView, LearnMore, GoDeeper, sheets, glass, …)
src/audio/          the audio player: sessions/chapters, engine, downloads, saved position
src/state/          on-device data: settings, reading list, cached explainers
src/data/           edition loading + caching, API calls, the sample edition, types
src/lib/            notifications, PDF export, formatting
supabase/           the backend: database migrations + edge functions
plugins/            config plugins (Android home-screen shortcuts)
```

## Voice assistants, CarPlay and Android Auto

- **Siri:** open the Shortcuts app → **+** → add the **Open URLs** action with
  `brewsy://listen` (or `brewsy://listen?mode=quick`) → name it "Play my briefing". Then
  "Hey Siri, play my briefing" starts it. A built-in Siri phrase (no setup) needs App Intents,
  native Swift code in a custom development build; it isn't in this app yet.
- **Google Assistant / Android:** long-press the Brewsy icon for **Listen to briefing** and
  **Quick listen** (drag one to the home screen for one tap). "Hey Google, open Brewsy" works;
  a spoken "play my briefing" command would need Google's App Actions (a `shortcuts.xml`
  capability plus Play Console review).
- **Lock screen, Bluetooth and car:** play/pause and the ±10 buttons work everywhere; in Brewsy
  the ±10 buttons move to the previous/next story. Bluetooth and car next/previous buttons
  aren't wired to stories, because expo-audio only offers ±10s seek commands.
- **Full CarPlay / Android Auto apps** (a Brewsy screen in the car with a chapter list) need:
  a native media module (react-native-track-player v5, which is licensed, or custom native
  code), Apple's CarPlay audio entitlement (requested from Apple), an Android
  `MediaBrowserService` + Android Auto metadata, and a development build. Until then, Brewsy
  shows up in the car like any audio app playing through Bluetooth/USB.
