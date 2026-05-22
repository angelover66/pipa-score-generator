import { PipaNote, Difficulty } from './types';

const OPEN_STRINGS = [62, 57, 52, 50];
const MAX_FRET = 24;

interface Position {
  stringNumber: 1 | 2 | 3 | 4;
  fretPosition: number;
  pitch: number;
}

function getCandidates(pitch: number, difficulty: Difficulty): Position[] {
  const candidates: Position[] = [];
  const maxFret = difficulty === 'easy' ? 6 : difficulty === 'medium' ? 15 : MAX_FRET;
  for (let s = 0; s < 4; s++) {
    const fret = pitch - OPEN_STRINGS[s];
    if (fret >= 0 && fret <= maxFret) {
      candidates.push({ stringNumber: (s + 1) as 1 | 2 | 3 | 4, fretPosition: fret, pitch });
    }
  }
  return candidates;
}

export function optimizePositions(notes: PipaNote[], difficulty: Difficulty): PipaNote[] {
  if (notes.length === 0) return notes;
  const dp: Array<Array<{ pos: Position; cost: number; prev: number | null }>> = [];
  const firstCandidates = getCandidates(notes[0].pitch, difficulty);
  if (firstCandidates.length === 0) return notes;
  dp[0] = firstCandidates.map((pos) => ({ pos, cost: 0, prev: null }));

  for (let i = 1; i < notes.length; i++) {
    const candidates = getCandidates(notes[i].pitch, difficulty);
    if (candidates.length === 0) {
      notes[i].stringNumber = notes[i - 1].stringNumber;
      notes[i].fretPosition = notes[i - 1].fretPosition;
      continue;
    }
    dp[i] = candidates.map((pos) => {
      let minCost = Infinity;
      let bestPrev: number | null = null;
      for (let k = 0; k < dp[i - 1].length; k++) {
        const fretDistance = Math.abs(pos.fretPosition - dp[i - 1][k].pos.fretPosition);
        const stringPenalty = pos.stringNumber !== dp[i - 1][k].pos.stringNumber ? 2 : 0;
        const jumpPenalty = difficulty === 'medium' && fretDistance > 5 ? 100 : 0;
        const cost = dp[i - 1][k].cost + fretDistance + stringPenalty + jumpPenalty;
        if (cost < minCost) { minCost = cost; bestPrev = k; }
      }
      return { pos, cost: minCost, prev: bestPrev };
    });
  }

  const result: Array<{ pos: Position }> = [];
  let bestLast = 0;
  for (let k = 1; k < dp[dp.length - 1].length; k++) {
    if (dp[dp.length - 1][k].cost < dp[dp.length - 1][bestLast].cost) bestLast = k;
  }
  let cur: number | null = bestLast;
  for (let i = dp.length - 1; i >= 0; i--) {
    result.unshift({ pos: dp[i][cur!].pos });
    cur = dp[i][cur!].prev;
  }

  return notes.map((note, i) => ({
    ...note,
    stringNumber: result[i]?.pos.stringNumber ?? 1,
    fretPosition: result[i]?.pos.fretPosition ?? 0,
  }));
}
