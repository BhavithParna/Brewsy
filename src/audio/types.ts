import type { ListenMode } from '@/data/types';

/** One thing the player can play: a slice of an MP3, or text read aloud by the phone. */
export type Chapter = {
  /** `${editionDate}:${storyId}` for stories (same key as the Reading List), else null. */
  key: string | null;
  storyId: string | null;
  editionDate: string;
  title: string;
  /** MP3 (local file or URL), or null to read `script` aloud with the device voice. */
  uri: string | null;
  /** Seconds into `uri` where this chapter starts. */
  start: number;
  /** Seconds at 1×. */
  duration: number;
  script: string;
  /** Shown on the lock screen. */
  artworkUrl?: string;
};

export type Session = {
  /** Stable id, used to remember where you stopped (e.g. "edition:2026-10-07:full"). */
  id: string;
  kind: 'edition' | 'list';
  /** "Full briefing · Wed 7 Oct", "Your reading list". */
  title: string;
  mode?: ListenMode;
  editionDate?: string;
  chapters: Chapter[];
  /** True when chapters come from the server's MP3s (not the device voice). */
  hasServerAudio: boolean;
  /** Why the phone's voice is reading, when it is (see phoneVoiceNote). */
  phoneVoice?: PhoneVoiceReason;
};

/** sample: the bundled sample edition · off: the server has no voice service · pending: MP3s not made yet. */
export type PhoneVoiceReason = 'sample' | 'off' | 'pending';

export type PlayerState = {
  session: Session | null;
  index: number;
  playing: boolean;
  buffering: boolean;
  /** Seconds into the current chapter. */
  position: number;
  rate: number;
  engine: 'audio' | 'speech' | null;
  /** The last chapter ended. */
  finished: boolean;
  error: string | null;
};

export const RATES = [0.8, 1, 1.25, 1.5, 2] as const;
