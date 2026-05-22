import { RawNote, ScoreData, Difficulty, PipaNote } from './types';
import { reduceDifficulty, adjustTempo } from './difficultyReducer';
import { allocateTechniques, matchTechnique } from './techniqueAllocator';
import { optimizePositions } from './positionOptimizer';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function estimateTempo(rawNotes: RawNote[]): number {
  if (rawNotes.length < 8) return 80;
  const intervals: number[] = [];
  for (let i = 1; i < rawNotes.length; i++) {
    intervals.push(rawNotes[i].startTime - rawNotes[i - 1].startTime);
  }
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];
  return Math.round(60 / (medianInterval * 4));
}

function groupIntoMeasures(notes: PipaNote[]): import('./types').Measure[] {
  const measures: import('./types').Measure[] = [];
  const notesPerMeasure = 16;
  for (let i = 0; i < notes.length; i += notesPerMeasure) {
    measures.push({
      index: measures.length,
      timeSignature: [4, 4],
      notes: notes.slice(i, i + notesPerMeasure),
    });
  }
  return measures;
}

export function generateScore(
  rawNotes: RawNote[],
  difficulty: Difficulty,
  title: string,
  sourceType: 'upload' | 'preset',
  audioHash: string
): ScoreData {
  const estimatedTempo = estimateTempo(rawNotes);
  const adjustedTempo = adjustTempo(estimatedTempo, difficulty);
  let notes = reduceDifficulty(rawNotes, difficulty, estimatedTempo);
  notes = optimizePositions(notes, difficulty);

  if (difficulty === 'easy') {
    notes = allocateTechniques(notes, difficulty, 6);
  } else if (difficulty === 'medium') {
    notes = allocateTechniques(notes, difficulty, 2);
  } else {
    notes = notes.map((note, i) => ({
      ...note,
      technique: matchTechnique(note, i > 0 ? notes[i - 1] : null),
    }));
  }

  const measures = groupIntoMeasures(notes);
  return {
    id: generateId(),
    title,
    sourceType,
    originalAudioHash: audioHash,
    key: 'D',
    tempo: adjustedTempo,
    difficulty,
    measures,
    createdAt: new Date().toISOString(),
  };
}

export function generateAllDifficulties(
  rawNotes: RawNote[],
  title: string,
  sourceType: 'upload' | 'preset'
): Record<Difficulty, ScoreData> {
  const audioHash = title + Date.now();
  return {
    easy: generateScore(rawNotes, 'easy', title, sourceType, audioHash),
    medium: generateScore(rawNotes, 'medium', title, sourceType, audioHash),
    hard: generateScore(rawNotes, 'hard', title, sourceType, audioHash),
  };
}
