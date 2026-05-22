import { RawNote, PipaNote, Difficulty } from './types';

const DIFFICULTY_SPEED_FACTOR: Record<Difficulty, number> = {
  easy: 0.75,
  medium: 0.9,
  hard: 1.0,
};

function isStrongBeat(startTime: number, tempo: number): boolean {
  const beatDuration = 60 / tempo;
  const beatIndex = Math.round(startTime / beatDuration) % 4;
  return beatIndex === 0 || beatIndex === 2;
}

export function reduceDifficulty(rawNotes: RawNote[], difficulty: Difficulty, tempo: number): PipaNote[] {
  const beatDuration = 60 / tempo / 4;
  let notes: PipaNote[] = rawNotes.map((n) => ({
    pitch: n.pitch,
    stringNumber: 1 as const,
    fretPosition: 0,
    duration: (n.endTime - n.startTime) / beatDuration,
    technique: null,
    isStrongBeat: isStrongBeat(n.startTime, tempo),
  }));

  switch (difficulty) {
    case 'easy': notes = reduceEasy(notes); break;
    case 'medium': notes = reduceMedium(notes); break;
    case 'hard': break;
  }
  return notes;
}

function reduceEasy(notes: PipaNote[]): PipaNote[] {
  return notes
    .filter((n) => n.isStrongBeat)
    .filter((n, i, arr) => i === 0 || n.pitch !== arr[i - 1].pitch)
    .map((n) => ({
      ...n,
      duration: Math.max(Math.round(n.duration * 2) / 2, 0.5),
    }));
}

function reduceMedium(notes: PipaNote[]): PipaNote[] {
  return notes
    .filter((n) => n.duration >= 0.25)
    .filter((n, i) => n.isStrongBeat || (i > 0 && notes[i - 1].isStrongBeat));
}

export function adjustTempo(originalTempo: number, difficulty: Difficulty): number {
  return Math.round(originalTempo * DIFFICULTY_SPEED_FACTOR[difficulty]);
}
