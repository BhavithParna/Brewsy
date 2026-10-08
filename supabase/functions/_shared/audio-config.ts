// ─────────────────────────────────────────────────────────────────────────────
// AUDIO BRIEFING SETTINGS. Choose the voice service here.
//
// Every morning, a few minutes after the edition is ready, the server writes two
// listening scripts (Quick ≈ 3 min, Full ≈ 10 min), turns each chapter into an
// MP3 with the service below, and saves the files to Supabase Storage.
//
// PROVIDER = 'openai' | 'elevenlabs' | 'none'
//   (the TTS_PROVIDER secret overrides this without a redeploy)
//
// What it costs (about 13 minutes of audio a day, ≈ 11,700 characters):
//
//   openai      gpt-4o-mini-tts, billed per token: about $0.015 per minute of
//               audio → ≈ $0.20 a day ≈ $6 a month. Very natural; can be told
//               how to sound (see OPENAI.instructions). Needs OPENAI_API_KEY.
//
//   elevenlabs  The most lifelike voices. API pricing (Sept 2026):
//               eleven_multilingual_v2 ≈ $0.10 per 1,000 characters → ≈ $35 a month;
//               eleven_flash_v2_5     ≈ $0.05 per 1,000 characters → ≈ $18 a month.
//               The Creator plan ($22/month) includes enough Flash characters.
//               Needs ELEVENLABS_API_KEY.
//
//   none        No server audio. The app reads the same radio-style script
//               aloud with the phone's built-in voice (free, more robotic).
//
// Prices change; check openai.com/api/pricing and elevenlabs.io/pricing.
// ─────────────────────────────────────────────────────────────────────────────

export type TtsProvider = 'openai' | 'elevenlabs' | 'none';

export const PROVIDER: TtsProvider = 'openai';

export const OPENAI = {
  model: 'gpt-4o-mini-tts',
  /** OpenAI recommends marin or cedar for the best quality. Others: alloy, ash, coral, sage, verse… */
  voice: 'marin',
  instructions:
    'You are a calm, warm morning radio news host. Speak clearly at a relaxed, steady pace, ' +
    'with natural pauses between sentences and a short pause before each new story. Neutral tone, no drama.',
};

export const ELEVENLABS = {
  /** 'eleven_multilingual_v2' (best quality) or 'eleven_flash_v2_5' (half the price, still good). */
  model: 'eleven_multilingual_v2',
  /** A premade voice. Pick another in the ElevenLabs Voice Library, or set ELEVENLABS_VOICE_ID. */
  voiceId: 'JBFqnCBsd6RMkjVDRZzb',
  /** Codec_sampleRate_bitrate. 128 kbps is the default every plan allows. */
  outputFormat: 'mp3_44100_128',
};

/** Spoken words per minute, used to estimate lengths when there's no MP3. */
export const WORDS_PER_MINUTE = 150;

/** Days of audio kept in Storage (the free plan has 1 GB; a day is ≈ 25 MB). */
export const KEEP_AUDIO_DAYS = 7;

export function ttsProvider(): TtsProvider {
  const env = Deno.env.get('TTS_PROVIDER')?.trim().toLowerCase();
  const chosen: TtsProvider = env === 'openai' || env === 'elevenlabs' || env === 'none' ? env : PROVIDER;
  // No key for the chosen service yet: skip the MP3s (the phone's voice reads the
  // script) instead of failing, retrying and alerting every morning.
  if (chosen === 'openai' && !Deno.env.get('OPENAI_API_KEY')) return 'none';
  if (chosen === 'elevenlabs' && !Deno.env.get('ELEVENLABS_API_KEY')) return 'none';
  return chosen;
}

export function voiceLabel(provider: TtsProvider): string | null {
  if (provider === 'openai') return `OpenAI · ${OPENAI.voice}`;
  if (provider === 'elevenlabs') return 'ElevenLabs';
  return null;
}
