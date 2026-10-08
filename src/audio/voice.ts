import { getLocales } from 'expo-localization';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import type { PhoneVoiceReason } from './types';
import { settingsStore } from '@/state/settings';

/**
 * Choosing the phone's voice (used only when an edition has no studio-voice MP3).
 *
 * Phones ship several English voices and the default is often the most robotic one
 * (iOS picks a "compact" voice). We rank them and use the best, unless the reader
 * picked one in Settings → Listening.
 */

export type DeviceVoice = {
  id: string;
  /** "Ava", or "American English 2" for Android's coded names. */
  label: string;
  /** "Premium · American", "High quality", … */
  detail: string;
  score: number;
};

const REGION: Record<string, string> = {
  US: 'American',
  GB: 'British',
  IN: 'Indian',
  AU: 'Australian',
  CA: 'Canadian',
  IE: 'Irish',
  NZ: 'New Zealand',
  ZA: 'South African',
  NG: 'Nigerian',
  SG: 'Singapore',
};

let cache: Promise<DeviceVoice[]> | null = null;

/** English voices on this phone, best-sounding first. */
export function deviceVoices(): Promise<DeviceVoice[]> {
  cache ??= load().then((list) => {
    // Android can answer with an empty list while its speech engine is still starting.
    if (!list.length) cache = null;
    return list;
  });
  return cache;
}

/** The voice to speak with: the reader's pick if it's still installed, else the best one. */
export async function resolveVoice(): Promise<string | undefined> {
  const voices = await deviceVoices().catch(() => []);
  const picked = settingsStore.get().listenVoice;
  if (picked && voices.some((v) => v.id === picked)) return picked;
  return voices[0]?.id;
}

async function load(): Promise<DeviceVoice[]> {
  const all = await Speech.getAvailableVoicesAsync();
  const region = getLocales()[0]?.regionCode?.toUpperCase() ?? null;
  const ids = new Set(all.map((v) => v.identifier));

  const ranked = all
    .map((v) => ({ v, lang: v.language.replace('_', '-'), score: score(v, region, ids) }))
    .filter((x): x is { v: Speech.Voice; lang: string; score: number } => x.score != null)
    .sort((a, b) => b.score - a.score);

  const counters: Record<string, number> = {};
  return ranked.map(({ v, lang, score }) => {
    const code = lang.split('-')[1]?.toUpperCase() ?? '';
    const accent = REGION[code] ?? (code || 'English');
    const premium = /premium/i.test(v.identifier);
    const enhanced = v.quality === Speech.VoiceQuality.Enhanced;
    const quality = premium ? 'Premium' : enhanced ? (Platform.OS === 'ios' ? 'Enhanced' : 'High quality') : 'Standard';
    // Android voices are named like "en-us-x-iol-local": number them per accent instead.
    const coded = Platform.OS === 'android' || /^[a-z]{2,3}[-_][a-z]{2}/i.test(v.name);
    counters[accent] = (counters[accent] ?? 0) + 1;
    const label = coded ? `${accent} English ${counters[accent]}` : v.name.replace(/\s*\((Enhanced|Premium)\)/i, '');
    const needsNet = /network/i.test(v.identifier) ? ' · needs internet' : '';
    // Browsers don't report quality, so only the accent is worth showing there.
    const detail = Platform.OS === 'web' ? accent : coded ? `${quality}${needsNet}` : `${quality} · ${accent}`;
    return { id: v.identifier, label, detail, score };
  });
}

function score(v: Speech.Voice, region: string | null, ids: Set<string>): number | null {
  const id = v.identifier.toLowerCase();
  const lang = v.language.toLowerCase().replace('_', '-');
  if (!lang.startsWith('en')) return null;
  // iOS novelty voices (Bells, Bad News, …) and the old Eloquence voices (Eddy, Flo, …).
  if (id.includes('speech.synthesis') || id.includes('eloquence')) return null;
  // Android lists most Google voices twice; keep the on-device copy (works offline).
  if (id.endsWith('-network') && ids.has(v.identifier.replace(/-network$/i, '-local'))) return null;

  let s = 0;
  if (id.includes('premium')) s += 6; // iOS Premium voices (downloaded in iOS Settings)
  if (v.quality === Speech.VoiceQuality.Enhanced) s += 4;
  if (id.includes('siri')) s += 3;
  if (Platform.OS === 'web' && /natural|neural|online|google/i.test(v.name)) s += 3; // browser cloud voices
  if (id.includes('#')) s -= 2; // older Google voice variants
  if (id.includes('compact')) s -= 1;
  if (id.includes('espeak')) s -= 3; // the classic robot voice
  if (region && lang.endsWith(`-${region.toLowerCase()}`)) s += 2;
  else if (lang === 'en-us' || lang === 'en-gb') s += 1;
  return s;
}

/** A short sample in the given voice (Settings → Listening). */
export function previewVoice(id: string | undefined) {
  Speech.stop().catch(() => {});
  Speech.speak("Good morning. Here's what you need to know.", { voice: id });
}

/** Says which voice is reading and how to get a better one. */
export function phoneVoiceNote(reason: PhoneVoiceReason | undefined): string {
  const tip = 'Try another voice in Settings → Phone voice.';
  if (reason === 'sample') return `Read by your phone’s voice: the sample edition has no studio voice. ${tip}`;
  if (reason === 'off') return `Read by your phone’s voice: no voice service is set up on the server yet. ${tip}`;
  if (reason === 'pending') return 'Read by your phone’s voice for now. The studio-voice version arrives a few minutes after each edition.';
  return `Read by your phone’s voice. ${tip}`;
}
