import {
  createAudioPlayer,
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import { downloadAudio } from './downloads';
import { clearProgress, saveProgress, savedProgress } from './progress';
import { initialRate, playerStore } from './store';
import type { Chapter, Session } from './types';
import { resolveVoice } from './voice';
import { updateSettings } from '@/state/settings';

/**
 * The one audio player for the whole app.
 *
 * An edition plays from ONE combined MP3; chapters are time ranges inside it, so
 * playback keeps going on the lock screen without any JavaScript. Next/Previous
 * seek to chapter starts. Chapters without an MP3 are read by the phone's voice.
 *
 * Lock screen / notification controls: expo-audio offers play/pause and ±10 second
 * buttons only (it has no next/previous track commands). We treat a ±10s jump that
 * we didn't make ourselves as "next story" / "previous story", so those buttons move
 * between stories while the screen is locked.
 */

const REMOTE_SKIP = 10;
/** Back within this many seconds of a chapter's start goes to the previous chapter. */
const RESTART_WINDOW = 4;

let player: AudioPlayer | null = null;
let loadedUri: string | null = null;
let pendingSeek: number | null = null;
/** Where the last seek we asked for should land (stale status updates are ignored until then). */
let seekTarget: number | null = null;
let wantPlaying = false;
let ignoreJumpsUntil = 0;
let last: { t: number; at: number; playing: boolean } | null = null;
let lockScreenOn = false;
let lastSavedAt = 0;
let speechToken = 0;
let speechTimer: ReturnType<typeof setInterval> | null = null;
let audioModeReady: Promise<void> | null = null;

function ensureAudioMode() {
  audioModeReady ??= (async () => {
    try {
      // 'doNotMix' is required for lock screen controls.
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
    } catch {
      // Web or an old build: plays in the foreground only.
    }
    if (Platform.OS === 'android') {
      // Android 13+ shows the media controls as a notification, which needs this permission.
      await requestNotificationPermissionsAsync().catch(() => {});
    }
  })();
  return audioModeReady;
}

function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 250 });
    player.addListener('playbackStatusUpdate', onStatus);
  }
  return player;
}

const current = (): Chapter | undefined => {
  const s = playerStore.get();
  return s.session?.chapters[s.index];
};

function lockScreenMeta(ch: Chapter, session: Session) {
  return { title: ch.title, artist: session.title, albumTitle: 'Brewsy', artworkUrl: ch.artworkUrl };
}

function showOnLockScreen() {
  const ch = current();
  const { session } = playerStore.get();
  if (!player || !ch || !session) return;
  const meta = lockScreenMeta(ch, session);
  try {
    if (!lockScreenOn) {
      player.setActiveForLockScreen(true, meta, { showSeekBackward: true, showSeekForward: true });
      lockScreenOn = true;
    } else {
      player.updateLockScreenMetadata(meta);
    }
  } catch {
    // Not supported here (web, Expo Go): the in-app controls still work.
  }
}

function persist(force = false) {
  const { session, index, position, finished } = playerStore.get();
  if (!session || finished) return;
  const now = Date.now();
  if (!force && now - lastSavedAt < 5000) return;
  lastSavedAt = now;
  saveProgress(session.id, index, position);
}

// ─── Device voice (fallback) ────────────────────────────────────────────────

function stopSpeech() {
  speechToken++;
  if (speechTimer) clearInterval(speechTimer);
  speechTimer = null;
  Speech.stop().catch(() => {});
}

function speakChapter(index: number) {
  const { session, rate } = playerStore.get();
  const ch = session?.chapters[index];
  if (!ch) return;
  stopSpeech();
  const token = speechToken;
  const startedAt = Date.now();
  playerStore.set({ engine: 'speech', playing: true, buffering: false, position: 0, finished: false });
  // The voice reports no progress, so estimate it for the progress bar.
  speechTimer = setInterval(() => {
    if (token !== speechToken) return;
    playerStore.set({ position: Math.min(ch.duration, ((Date.now() - startedAt) / 1000) * rate) });
  }, 500);
  resolveVoice().then((voice) => {
    if (token !== speechToken) return;
    Speech.speak(ch.script, {
      rate,
      voice,
      onDone: () => {
        if (token !== speechToken) return;
        // Finishing a long chapter instantly means nothing was spoken (no voice installed).
        if (Date.now() - startedAt < 800 && ch.script.length > 80) speechFailed();
        else advanceFrom(index);
      },
      onError: () => {
        if (token === speechToken) speechFailed();
      },
    });
  });
}

function speechFailed() {
  stopSpeech();
  playerStore.set({ playing: false, error: 'Your phone’s voice couldn’t start. Check that a text-to-speech voice is installed.' });
}

/**
 * The MP3 couldn't play (offline and not downloaded, or deleted from storage):
 * read the rest of that file's chapters with the phone's voice instead.
 */
function fallBackToSpeech(index: number) {
  const { session } = playerStore.get();
  if (!session || !loadedUri) return;
  const failed = loadedUri;
  loadedUri = null;
  player?.pause();
  playerStore.set({
    session: { ...session, chapters: session.chapters.map((c) => (c.uri === failed ? { ...c, uri: null } : c)) },
  });
  startChapter(index, 0, wantPlaying);
}

// ─── Chapters ───────────────────────────────────────────────────────────────

async function startChapter(index: number, offset = 0, autoplay = true) {
  const { session, rate } = playerStore.get();
  const ch = session?.chapters[index];
  if (!session || !ch) return;
  playerStore.set({ index, position: offset, finished: false, error: null });
  last = null;

  if (!ch.uri) {
    player?.pause();
    if (autoplay) speakChapter(index);
    else playerStore.set({ engine: 'speech', playing: false });
    persist(true);
    return;
  }

  stopSpeech();
  await ensureAudioMode();
  const p = getPlayer();
  playerStore.set({ engine: 'audio' });
  wantPlaying = autoplay;
  ignoreJumpsUntil = Date.now() + 2500;
  const target = ch.start + offset;
  seekTarget = target;
  if (loadedUri === ch.uri && p.isLoaded) {
    await p.seekTo(target).catch(() => {});
    if (autoplay) p.play();
  } else {
    loadedUri = ch.uri;
    p.replace({ uri: ch.uri });
    // Seek once the file is loaded (see onStatus), so we never play a blip from 0:00.
    pendingSeek = target > 0.3 ? target : null;
    if (autoplay && pendingSeek == null) p.play();
  }
  p.setPlaybackRate(rate);
  showOnLockScreen();
  persist(true);
}

/** After a chapter (or a whole file) ends: the next one, or the end. */
function advanceFrom(index: number) {
  const { session } = playerStore.get();
  if (!session) return;
  if (index + 1 < session.chapters.length) {
    startChapter(index + 1);
    return;
  }
  stopSpeech();
  playerStore.set({ playing: false, finished: true, position: session.chapters[index]?.duration ?? 0 });
  clearProgress(session.id);
}

/** The chapter that contains time `t` of the loaded file. */
function chapterAt(session: Session, t: number, fallback: number): number {
  let found = -1;
  session.chapters.forEach((c, i) => {
    if (c.uri === loadedUri && c.start <= t + 0.3) found = i;
  });
  return found === -1 ? fallback : found;
}

function onStatus(s: AudioStatus) {
  const state = playerStore.get();
  const { session } = state;
  if (!session || state.engine !== 'audio' || !player) return;

  if (pendingSeek != null && s.isLoaded) {
    const target = pendingSeek;
    pendingSeek = null;
    ignoreJumpsUntil = Date.now() + 2500;
    player
      .seekTo(target)
      .catch(() => {})
      .then(() => {
        if (wantPlaying) player?.play();
      });
    return;
  }

  // Lock screen ±10s buttons → previous / next story.
  const now = Date.now();
  if (last && now > ignoreJumpsUntil && s.isLoaded) {
    const elapsed = (now - last.at) / 1000;
    const expected = last.t + (last.playing ? elapsed * state.rate : 0);
    const jump = s.currentTime - expected;
    if (Math.abs(jump - REMOTE_SKIP) < 1.75) {
      last = null;
      next();
      return;
    }
    if (Math.abs(jump + REMOTE_SKIP) < 1.75) {
      const before = last.t - (session.chapters[state.index]?.start ?? 0);
      last = null;
      if (before > RESTART_WINDOW) startChapter(state.index, 0, s.playing);
      else previous();
      return;
    }
  }
  last = { t: s.currentTime, at: now, playing: s.playing };

  if (seekTarget != null) {
    if (Math.abs(s.currentTime - seekTarget) > 1.5 && now < ignoreJumpsUntil) {
      // Still reporting the old position from before our seek.
      playerStore.set({ playing: s.playing, buffering: s.isBuffering });
      return;
    }
    seekTarget = null;
  }

  if (s.error) {
    fallBackToSpeech(state.index);
    return;
  }

  const index = chapterAt(session, s.currentTime, state.index);
  const ch = session.chapters[index];
  const changed = index !== state.index;
  playerStore.set({
    index,
    playing: s.playing,
    buffering: s.isBuffering,
    position: Math.max(0, s.currentTime - (ch?.start ?? 0)),
  });
  if (changed) showOnLockScreen();
  persist(changed);

  if (s.didJustFinish) {
    // The file ended: continue with the first chapter that isn't in this file.
    const lastInFile = session.chapters.reduce((n, c, i) => (c.uri === loadedUri ? i : n), index);
    advanceFrom(lastInFile);
  }
}

// ─── Public controls ────────────────────────────────────────────────────────

/**
 * Starts a session. Without `at`, resumes where you stopped last time (if you did).
 * Starting the same session that's already loaded just jumps to `at`.
 */
export async function play(session: Session, at?: { index: number; position?: number }) {
  const state = playerStore.get();
  const same = state.session?.id === session.id;
  if (!same) {
    if (state.session) persist(true);
    player?.pause();
    stopSpeech();
    playerStore.set({ session, rate: state.session ? state.rate : initialRate(), finished: false });
  }
  const saved = at ? undefined : savedProgress(session.id);
  const index = at?.index ?? (saved && saved.index < session.chapters.length ? saved.index : 0);
  const position = at?.position ?? (saved && !at ? saved.position : 0);
  if (same && !at && state.engine) {
    if (!state.playing) resume();
    return;
  }
  await startChapter(Math.max(0, index), position);
  // Keep a copy for next time (and for when you're offline).
  const url = session.chapters.find((c) => c.uri?.startsWith('http'))?.uri;
  if (url && session.kind === 'edition') downloadAudio(url);
}

export function pause() {
  const { engine } = playerStore.get();
  wantPlaying = false;
  if (engine === 'speech') {
    stopSpeech();
    playerStore.set({ playing: false });
  } else {
    player?.pause();
  }
  persist(true);
}

export function resume() {
  const { engine, index, finished, position } = playerStore.get();
  if (finished) {
    startChapter(0);
    return;
  }
  if (engine === 'speech') {
    speakChapter(index);
  } else if (player && loadedUri) {
    wantPlaying = true;
    player.play();
  } else {
    startChapter(index, position);
  }
}

export function toggle() {
  if (playerStore.get().playing) pause();
  else resume();
}

export function next() {
  const { session, index } = playerStore.get();
  if (!session) return;
  if (index + 1 < session.chapters.length) startChapter(index + 1);
  else advanceFrom(index);
}

/** Restarts the chapter, or goes to the previous one when you're near its start. */
export function previous() {
  const { session, index, position } = playerStore.get();
  if (!session) return;
  startChapter(position > RESTART_WINDOW || index === 0 ? index : index - 1);
}

export function jumpTo(index: number) {
  startChapter(index);
}

export function setRate(rate: number) {
  playerStore.set({ rate });
  updateSettings({ listenRate: rate });
  const { engine, index, playing } = playerStore.get();
  if (engine === 'audio') player?.setPlaybackRate(rate);
  // The device voice picks up a new rate from the start of the chapter.
  else if (engine === 'speech' && playing) speakChapter(index);
}

/** Stops and hides the player. */
export function close() {
  persist(true);
  wantPlaying = false;
  stopSpeech();
  if (player) {
    player.pause();
    try {
      player.clearLockScreenControls();
    } catch {
      // ignore
    }
  }
  lockScreenOn = false;
  playerStore.set({ session: null, playing: false, engine: null, position: 0, index: 0, finished: false });
}
