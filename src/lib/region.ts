import { getLocales } from 'expo-localization';

import { REGIONS, type LocalRegion, type Region } from '../../supabase/functions/_shared/sources';
import { timeZone } from './device';

export { REGIONS, type LocalRegion, type Region };

export function isRegion(v: unknown): v is Region {
  return REGIONS.some((r) => r.id === v);
}

/** "Canada"; "Just world news" for WORLD. */
export function regionLabel(region: Region): string {
  return REGIONS.find((r) => r.id === region)?.label ?? region;
}

// Canada's zones (America/Toronto and friends) and the United States' zones. Other America/*
// zones (Mexico, Brazil…) belong to neither.
const CANADA = new Set(
  (
    'Toronto Montreal Vancouver Edmonton Winnipeg Halifax St_Johns Regina Moncton Glace_Bay Goose_Bay ' +
    'Whitehorse Dawson Dawson_Creek Fort_Nelson Yellowknife Inuvik Iqaluit Rankin_Inlet Resolute ' +
    'Cambridge_Bay Swift_Current Atikokan Creston Blanc-Sablon Rainy_River Thunder_Bay Nipigon Pangnirtung Coral_Harbour'
  )
    .split(' ')
    .map((z) => `America/${z}`),
);
const US = new Set([
  ...(
    'New_York Chicago Denver Los_Angeles Phoenix Anchorage Detroit Boise Juneau Sitka Nome Yakutat ' +
    'Metlakatla Adak Menominee Indianapolis Louisville Fort_Wayne Knox_IN Shiprock Atka'
  )
    .split(' ')
    .map((z) => `America/${z}`),
  'Pacific/Honolulu',
  'US/Eastern',
  'US/Central',
  'US/Mountain',
  'US/Pacific',
  'US/Alaska',
  'US/Hawaii',
  'US/Arizona',
]);

/** The region a timezone points to, or null when it doesn't point to one (same rules as the server). */
export function regionForTimeZone(tz: string): Region | null {
  if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN';
  if (CANADA.has(tz) || tz.startsWith('Canada/')) return 'CA';
  if (US.has(tz) || /^America\/(Indiana|Kentucky|North_Dakota)\//.test(tz)) return 'US';
  if (tz === 'Europe/London' || tz === 'GB') return 'UK';
  if (tz.startsWith('Australia/')) return 'AU';
  return null;
}

/** Where the phone seems to be: its timezone first, then its language region, else world news only. */
export function guessRegion(): Region {
  const byZone = regionForTimeZone(timeZone());
  if (byZone) return byZone;
  try {
    const code = getLocales()[0]?.regionCode?.toUpperCase();
    const id = code === 'GB' ? 'UK' : code;
    if (id && id !== 'WORLD' && isRegion(id)) return id;
  } catch {
    // No locale information: world news only.
  }
  return 'WORLD';
}
