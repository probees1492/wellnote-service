/**
 * WebAudio-synthesised pen-scratch sound.
 *
 * We avoid shipping audio assets — each click is a sub-50ms white noise burst
 * shaped by a band-pass filter and AHDSR envelope, with per-keystroke
 * randomisation so successive keystrokes never sound identical.
 *
 * Volume is intentionally low (peak gain ~0.08) so even with many keystrokes
 * the soundscape feels like a real ballpoint, not a click track.
 */

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let lastPlayedAt = 0;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

function ensureNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  // 0.5s of white noise — plenty for sub-50ms slices.
  const length = Math.floor(audio.sampleRate * 0.5);
  const buf = audio.createBuffer(1, length, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buf;
  return buf;
}

/**
 * Play one short pen-scratch tick. Safe to call on every keystroke;
 * we throttle to at most one tick per ~25ms to avoid CPU spikes during
 * fast typing or held keys (autorepeat).
 */
export function playPenTick(): void {
  const audio = ensureContext();
  if (!audio) return;

  // Most browsers start AudioContext suspended until a user gesture.
  // The keystroke itself is a gesture, but resume() is a no-op when
  // already running.
  if (audio.state === "suspended") {
    audio.resume().catch(() => {
      /* ignore */
    });
  }

  const now = audio.currentTime;
  const wallNow = performance.now();
  if (wallNow - lastPlayedAt < 25) return;
  lastPlayedAt = wallNow;

  try {
    const buffer = ensureNoiseBuffer(audio);
    const src = audio.createBufferSource();
    src.buffer = buffer;
    // Random start offset into the noise buffer for variety.
    const startOffset = Math.random() * 0.4;

    // Band-pass to taste — scratchy mids around 2-4kHz.
    const bp = audio.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2200 + Math.random() * 1800;
    bp.Q.value = 0.6 + Math.random() * 0.4;

    // High-pass to strip rumble.
    const hp = audio.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;

    const gain = audio.createGain();
    const peak = 0.05 + Math.random() * 0.03; // 0.05-0.08
    const duration = 0.018 + Math.random() * 0.022; // 18-40ms

    // AHDSR-ish: very fast attack, immediate decay.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(audio.destination);

    src.start(now, startOffset, duration + 0.02);
    src.stop(now + duration + 0.03);
    src.onended = () => {
      try {
        src.disconnect();
        bp.disconnect();
        hp.disconnect();
        gain.disconnect();
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* ignore — audio is non-essential */
  }
}
