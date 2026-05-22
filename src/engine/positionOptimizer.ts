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
  const dp: Array<Array<{ pos: Position; cost: number; prev: number | null }> | null> = [];
  const firstCandidates = getCandidates(notes[0].pitch, difficulty);
  if (firstCandidates.length === 0) return notes;
  dp[0] = firstCandidates.map((pos) => ({ pos, cost: 0, prev: null }));

  for (let i = 1; i < notes.length; i++) {
    const candidates = getCandidates(notes[i].pitch, difficulty);
    if (candidates.length === 0) {
      // 无可选指位，沿用上一音符状态
      notes[i].stringNumber = notes[i - 1].stringNumber;
      notes[i].fretPosition = notes[i - 1].fretPosition;
      dp[i] = null;
      continue;
    }
    // 确保前一状态存在，否则回退到dp[0]
    let prevDpIdx = i - 1;
    while (prevDpIdx >= 0 && dp[prevDpIdx] === null) prevDpIdx--;
    if (prevDpIdx < 0) prevDpIdx = 0;
    const prevDp = dp[prevDpIdx]!;

    dp[i] = candidates.map((pos) => {
      let minCost = Infinity;
      let bestPrev: number | null = null;
      for (let k = 0; k < prevDp.length; k++) {
        const fretDistance = Math.abs(pos.fretPosition - prevDp[k].pos.fretPosition);
        const stringPenalty = pos.stringNumber !== prevDp[k].pos.stringNumber ? 2 : 0;
        const jumpPenalty = difficulty === 'medium' && fretDistance > 5 ? 100 : 0;
        const cost = prevDp[k].cost + fretDistance + stringPenalty + jumpPenalty;
        if (cost < minCost) { minCost = cost; bestPrev = k; }
      }
      return { pos, cost: minCost, prev: bestPrev };
    });
  }

  // 从最后一个有效 dp 项开始回溯
  let lastValidIdx = dp.length - 1;
  while (lastValidIdx >= 0 && dp[lastValidIdx] === null) lastValidIdx--;
  if (lastValidIdx < 0) return notes;
  const lastDp = dp[lastValidIdx]!;

  let bestLast = 0;
  for (let k = 1; k < lastDp.length; k++) {
    if (lastDp[k].cost < lastDp[bestLast].cost) bestLast = k;
  }

  const result: Array<{ pos: Position }> = [];
  let cur: number | null = bestLast;
  for (let i = lastValidIdx; i >= 0; i--) {
    const entry = dp[i];
    if (entry === null) {
      // 跳过的音符复用后一音符的指位（反向填充）
      const fallbackPos = result[0]?.pos;
      result.unshift({ pos: fallbackPos ?? { stringNumber: 1, fretPosition: 0, pitch: notes[i].pitch } });
      continue;
    }
    result.unshift({ pos: entry[cur!].pos });
    cur = entry[cur!].prev;
  }

  // result 长度可能与 notes 不一致（开头或结尾有无候选的音符），补齐或截断
  while (result.length < notes.length) {
    result.unshift({ pos: result[0]?.pos ?? { stringNumber: 1, fretPosition: 0, pitch: notes[result.length].pitch } });
  }

  return notes.map((note, i) => ({
    ...note,
    stringNumber: result[i]?.pos.stringNumber ?? 1,
    fretPosition: result[i]?.pos.fretPosition ?? 0,
  }));
}
