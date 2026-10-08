// Just enough MP3 (MPEG audio Layer III) parsing to join chapter files into one
// briefing and know exactly where each chapter starts.
//
// Text-to-speech APIs return one MP3 per chapter. Each may start with an ID3
// tag and a silent "Xing"/"Info"/"VBRI" header frame that states the file's
// own length. Joining files byte-for-byte would leave those headers in the
// middle (and the first one would claim the wrong total length, which breaks
// seeking), so we keep only the audio frames and sum their exact durations.

export type Mp3Audio = {
  /** Audio frames only: no ID3 tags, no Xing/Info/VBRI header frame. */
  frames: Uint8Array;
  /** Seconds, from the frame count (exact, unlike bitrate estimates). */
  duration: number;
  sampleRate: number;
  frameCount: number;
};

// Layer III bitrates (kbps) by header index.
const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

export type FrameHeader = { length: number; samples: number; sampleRate: number; mono: boolean; mpeg1: boolean };

/** Reads a Layer III frame header at `i`, or null if there isn't a valid one. */
export function readFrameHeader(b: Uint8Array, i: number): FrameHeader | null {
  if (i + 4 > b.length) return null;
  if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const version = (b[i + 1] >> 3) & 0x03; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5, 1 = reserved
  const layer = (b[i + 1] >> 1) & 0x03; // 1 = Layer III
  if (version === 1 || layer !== 1) return null;
  const bitrateIndex = (b[i + 2] >> 4) & 0x0f;
  const rateIndex = (b[i + 2] >> 2) & 0x03;
  if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;
  const padding = (b[i + 2] >> 1) & 0x01;
  const mpeg1 = version === 3;
  const bitrate = (mpeg1 ? BITRATES_V1 : BITRATES_V2)[bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[version][rateIndex];
  const samples = mpeg1 ? 1152 : 576;
  const length = Math.floor(((mpeg1 ? 144 : 72) * bitrate) / sampleRate) + padding;
  const mono = ((b[i + 3] >> 6) & 0x03) === 3;
  return { length, samples, sampleRate, mono, mpeg1 };
}

function id3v2Size(b: Uint8Array, i: number): number {
  if (i + 10 > b.length || b[i] !== 0x49 || b[i + 1] !== 0x44 || b[i + 2] !== 0x33) return 0; // "ID3"
  const size = ((b[i + 6] & 0x7f) << 21) | ((b[i + 7] & 0x7f) << 14) | ((b[i + 8] & 0x7f) << 7) | (b[i + 9] & 0x7f);
  const footer = (b[i + 5] & 0x10) !== 0 ? 10 : 0;
  return 10 + size + footer;
}

function ascii(b: Uint8Array, i: number, n: number): string {
  return i + n <= b.length ? String.fromCharCode(...b.subarray(i, i + n)) : '';
}

/** True for the silent header frame encoders put first (Xing/Info for CBR/VBR, VBRI from Fraunhofer). */
export function isInfoFrame(b: Uint8Array, i: number, h: FrameHeader): boolean {
  const sideInfo = h.mpeg1 ? (h.mono ? 17 : 32) : h.mono ? 9 : 17;
  const tag = ascii(b, i + 4 + sideInfo, 4);
  return tag === 'Xing' || tag === 'Info' || ascii(b, i + 36, 4) === 'VBRI';
}

/**
 * Walks the frames. Skips ID3v2 tags (anywhere), an ID3v1 "TAG" trailer, and
 * junk between frames (resyncs on the next valid header that is followed by
 * another valid header, so random 0xFF bytes don't fool it).
 */
export function parseMp3(bytes: Uint8Array): Mp3Audio {
  const ranges: [number, number][] = [];
  let duration = 0;
  let frameCount = 0;
  let sampleRate = 0;
  let i = 0;
  let first = true;
  // Right after a frame we're "in sync": the next header is trusted as is.
  // After junk (or at the start) a header must be followed by another one.
  let inSync = false;
  while (i < bytes.length) {
    const tag = id3v2Size(bytes, i);
    if (tag) {
      i += tag;
      inSync = false;
      continue;
    }
    if (bytes.length - i === 128 && ascii(bytes, i, 3) === 'TAG') break;
    const h = readFrameHeader(bytes, i);
    const next = h ? i + h.length : -1;
    const confirmed = h && h.length > 4 && next <= bytes.length &&
      (inSync || next === bytes.length || readFrameHeader(bytes, next) || id3v2Size(bytes, next) || ascii(bytes, next, 3) === 'TAG');
    if (!h || !confirmed) {
      i++;
      inSync = false;
      continue;
    }
    inSync = true;
    if (first && isInfoFrame(bytes, i, h)) {
      first = false;
      i = next;
      continue;
    }
    first = false;
    const last = ranges[ranges.length - 1];
    if (last && last[1] === i) last[1] = next;
    else ranges.push([i, next]);
    duration += h.samples / h.sampleRate;
    sampleRate ||= h.sampleRate;
    frameCount++;
    i = next;
  }
  const total = ranges.reduce((n, [a, z]) => n + (z - a), 0);
  const frames = new Uint8Array(total);
  let at = 0;
  for (const [a, z] of ranges) {
    frames.set(bytes.subarray(a, z), at);
    at += z - a;
  }
  return { frames, duration, sampleRate, frameCount };
}

/** Joins parsed chapters into one MP3 and returns where each one starts (seconds). */
export function joinMp3(parts: Mp3Audio[]): { bytes: Uint8Array; starts: number[]; duration: number } {
  const bytes = new Uint8Array(parts.reduce((n, p) => n + p.frames.length, 0));
  const starts: number[] = [];
  let at = 0;
  let t = 0;
  for (const p of parts) {
    starts.push(Math.round(t * 1000) / 1000);
    bytes.set(p.frames, at);
    at += p.frames.length;
    t += p.duration;
  }
  return { bytes, starts, duration: Math.round(t * 1000) / 1000 };
}
