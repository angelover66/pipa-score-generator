let audioContext: AudioContext | null = null;
const sampleCache: Map<number, AudioBuffer> = new Map();

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: 44100 });
  }
  return audioContext;
}

export async function loadPipaSamples(onProgress?: (percent: number) => void): Promise<void> {
  if (sampleCache.size > 0) return;
  const ctx = getAudioContext();
  const midiRange = { min: 40, max: 96 };
  const totalNotes = midiRange.max - midiRange.min + 1;

  for (let midi = midiRange.min; midi <= midiRange.max; midi++) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const sampleRate = ctx.sampleRate;
    const duration = 2.0;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 4);
      const fundamental = Math.sin(2 * Math.PI * freq * t);
      const h2 = 0.5 * Math.sin(2 * Math.PI * freq * 2 * t);
      const h3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);
      const h4 = 0.1 * Math.sin(2 * Math.PI * freq * 4 * t);
      data[i] = (fundamental + h2 + h3 + h4) * envelope * 0.6;
    }

    sampleCache.set(midi, buffer);
    onProgress?.(Math.round(((midi - midiRange.min) / totalNotes) * 100));
    // 每 4 个音符 yield 主线程，避免 UI 冻结
    if (midi % 4 === 0) await new Promise((r) => setTimeout(r, 0));
  }
}

export function getSample(midiNote: number): AudioBuffer | undefined {
  const clamped = Math.max(40, Math.min(96, midiNote));
  return sampleCache.get(clamped);
}

export { getAudioContext };
