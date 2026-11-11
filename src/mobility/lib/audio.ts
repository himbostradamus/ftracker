// Sound, speech and screen-wake helpers. Everything here degrades quietly:
// browsers may refuse audio until the first tap, and not every device offers
// speech synthesis or a wake lock.

let ctx: AudioContext | null = null;

export function audioSupported(): boolean {
  return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
}

// Must be called from a tap or key press at least once.
export function unlockAudio(): boolean {
  if (!audioSupported()) return false;
  try {
    const AC = (window as any).AudioContext ?? (window as any).webkitAudioContext;
    ctx = ctx ?? new AC();
    if (ctx!.state === 'suspended') void ctx!.resume();
    return true;
  } catch { return false; }
}

export const audioReady = () => !!ctx && ctx.state === 'running';

function tone(freq: number, at: number, len: number, volume: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = 'sine'; osc.frequency.value = freq;
  const t = ctx.currentTime + at;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.5), t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t); osc.stop(t + len + 0.05);
}

export type Sound = 'count' | 'start' | 'change' | 'finish';
export function playSound(kind: Sound, volume: number) {
  if (!audioReady()) return;
  if (kind === 'count') tone(660, 0, 0.12, volume);
  if (kind === 'start') { tone(880, 0, 0.18, volume); }
  if (kind === 'change') { tone(587, 0, 0.14, volume); tone(784, 0.16, 0.2, volume); }
  if (kind === 'finish') { tone(523, 0, 0.18, volume); tone(659, 0.2, 0.18, volume); tone(784, 0.4, 0.35, volume); }
}

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
export function speak(text: string, volume: number) {
  if (!speechSupported()) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.volume = volume; u.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
export function stopSpeech() { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }

export const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;
let lock: any = null;
export async function requestWake(): Promise<boolean> {
  if (!wakeLockSupported()) return false;
  try { lock = await (navigator as any).wakeLock.request('screen'); return true; } catch { return false; }
}
export function releaseWake() { try { lock?.release(); } catch { /* ignore */ } lock = null; }
