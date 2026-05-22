// src/audio/basicPitchTranscriber.ts
// Basic Pitch melody transcription wrapper
// Wraps @spotify/basic-pitch's evaluateModel + outputToNotesPoly into a simple
// promise-based interface returning RawNote[]
//
// Model files must be copied from node_modules/@spotify/basic-pitch/model/
// to public/models/basic-pitch/ at build time.

import { RawNote } from '../engine/types';
import { BasicPitch, outputToNotesPoly, noteFramesToTime } from '@spotify/basic-pitch';

const MODEL_PATH = '/models/basic-pitch/model.json';

let model: BasicPitch | null = null;

/**
 * Load the Basic Pitch TF model and create the inference wrapper.
 * Safe to call multiple times -- the model is only loaded once.
 */
export async function initBasicPitch(onProgress?: (percent: number) => void): Promise<void> {
  if (model) return;
  onProgress?.(10);
  model = new BasicPitch(MODEL_PATH);
  onProgress?.(30);
  // Wait for TF model to finish loading
  await model.model;
  onProgress?.(50);
}

/**
 * Transcribe a Float32Array of mono audio (22050 Hz) into RawNote[].
 * Throws if initBasicPitch hasn't been called yet.
 */
export async function transcribe(
  audioData: Float32Array,
  onProgress?: (percent: number) => void,
): Promise<RawNote[]> {
  if (!model) throw new Error('BASIC_PITCH_LOAD_FAIL: model not initialized');

  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];

  onProgress?.(40);

  // evaluateModel calls onComplete incrementally for each audio window
  await model.evaluateModel(
    audioData,
    (f: number[][], o: number[][], c: number[][]) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (p: number) => {
      onProgress?.(Math.round(40 + p * 40));
    },
  );

  onProgress?.(85);

  const noteEvents = outputToNotesPoly(frames, onsets);
  const timedNotes = noteFramesToTime(noteEvents);

  onProgress?.(95);

  const notes: RawNote[] = timedNotes.map((n) => ({
    pitch: n.pitchMidi,
    startTime: n.startTimeSeconds,
    endTime: n.startTimeSeconds + n.durationSeconds,
    velocity: n.amplitude,
  }));

  onProgress?.(100);
  return notes;
}

/**
 * Quick heuristic check: does this set of notes look like a real melody?
 * Returns true when there are at least 5 unique pitches and 10 total notes.
 */
export function validateHasMelody(notes: RawNote[]): boolean {
  if (notes.length === 0) return false;
  const uniquePitches = new Set(notes.map((n) => n.pitch));
  return uniquePitches.size >= 5 && notes.length >= 10;
}
