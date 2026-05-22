import { ScoreData, PlayerState } from '../engine/types';
import { getSample, getAudioContext } from './soundFontLoader';

interface PlayerCallbacks {
  onStateChange: (state: PlayerState) => void;
  onNoteChange: (noteIndex: number, measureIndex: number) => void;
  onProgress: (percent: number) => void;
}

export class ScorePlayer {
  private score: ScoreData | null = null;
  private state: PlayerState = 'stopped';
  private tempo: number = 80;
  private callbacks: PlayerCallbacks;
  private scheduledNodes: AudioBufferSourceNode[] = [];
  private currentNoteIndex: number = 0;
  private currentMeasureIndex: number = 0;
  private startTime: number = 0;
  private rafId: number = 0;

  constructor(callbacks: PlayerCallbacks) {
    this.callbacks = callbacks;
  }

  load(score: ScoreData): void {
    this.stop();
    this.score = score;
    this.tempo = score.tempo;
    this.currentNoteIndex = 0;
    this.currentMeasureIndex = 0;
  }

  async play(): Promise<void> {
    if (!this.score || this.state === 'playing') return;
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    this.state = 'playing';
    this.callbacks.onStateChange('playing');
    this.scheduleAllNotes();
    this.startTime = ctx.currentTime;
    this.startTracking();
  }

  private scheduleAllNotes(): void {
    if (!this.score) return;
    const ctx = getAudioContext();
    this.scheduledNodes = [];
    const beatDuration = 60 / this.tempo / 4;
    let timeOffset = 0;
    for (let m = 0; m < this.score.measures.length; m++) {
      for (let n = 0; n < this.score.measures[m].notes.length; n++) {
        const note = this.score.measures[m].notes[n];
        const sample = getSample(note.pitch);
        if (!sample) continue;
        const source = ctx.createBufferSource();
        source.buffer = sample;
        const gainNode = ctx.createGain();
        const hasTechnique = note.technique !== null;
        gainNode.gain.value = hasTechnique ? 0.9 : 0.7;
        source.connect(gainNode).connect(ctx.destination);
        const startTime = ctx.currentTime + timeOffset;
        source.start(startTime);
        source.stop(startTime + note.duration * beatDuration);
        this.scheduledNodes.push(source);
        timeOffset += note.duration * beatDuration;
      }
    }
  }

  private startTracking(): void {
    const track = () => {
      if (this.state !== 'playing') return;
      const ctx = getAudioContext();
      const elapsed = ctx.currentTime - this.startTime;
      const totalDuration = this.getTotalDuration();
      const percent = Math.min(100, (elapsed / totalDuration) * 100);
      this.callbacks.onProgress(percent);
      if (percent >= 100) { this.stop(); return; }
      this.rafId = requestAnimationFrame(track);
    };
    this.rafId = requestAnimationFrame(track);
  }

  private getTotalDuration(): number {
    if (!this.score) return 0;
    const beatDuration = 60 / this.tempo / 4;
    let total = 0;
    for (const measure of this.score.measures) {
      for (const note of measure.notes) {
        total += note.duration * beatDuration;
      }
    }
    return total;
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.callbacks.onStateChange('paused');
    this.scheduledNodes.forEach((n) => { try { n.stop(); } catch {} });
    cancelAnimationFrame(this.rafId);
    getAudioContext().suspend();
  }

  async resume(): Promise<void> {
    if (this.state !== 'paused' || !this.score) return;
    await getAudioContext().resume();
    this.state = 'playing';
    this.callbacks.onStateChange('playing');
    this.scheduleAllNotes();
    this.startTime = getAudioContext().currentTime;
    this.startTracking();
  }

  stop(): void {
    this.state = 'stopped';
    this.callbacks.onStateChange('stopped');
    this.scheduledNodes.forEach((n) => { try { n.stop(); } catch {} });
    this.scheduledNodes = [];
    cancelAnimationFrame(this.rafId);
    this.currentNoteIndex = 0;
    this.currentMeasureIndex = 0;
    this.callbacks.onProgress(0);
  }

  setTempo(newTempo: number): void {
    this.tempo = newTempo;
    if (this.state === 'playing') {
      this.stop();
      this.play();
    }
  }
}
