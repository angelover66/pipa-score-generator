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
    // 保留强拍 + 每第 4 个弱拍音符（保留旋律轮廓）
    .filter((n, i, arr) => {
      if (n.isStrongBeat) return true;
      // 弱拍上每隔 3 个保留一个，且音高与前后不同
      return i % 4 === 0 && (i === 0 || arr[i - 1].pitch !== n.pitch);
    })
    // 节奏量化到八分音符
    .map((n) => ({
      ...n,
      duration: Math.max(Math.round(n.duration * 2) / 2, 0.5),
    }));
}

function reduceMedium(notes: PipaNote[]): PipaNote[] {
  return notes
    // 仅过滤极短音符（32 分音符以下）
    .filter((n) => n.duration >= 0.125)
    // 保留强拍 + 弱拍上音高变化明显的音符
    .filter((n, i, arr) => {
      if (n.isStrongBeat) return true;
      if (i > 0 && Math.abs(n.pitch - arr[i - 1].pitch) >= 3) return true;
      if (i < arr.length - 1 && Math.abs(n.pitch - arr[i + 1].pitch) >= 3) return true;
      // 每隔一个弱拍保留一个
      return i % 2 === 0;
    });
}

export function adjustTempo(originalTempo: number, difficulty: Difficulty): number {
  return Math.round(originalTempo * DIFFICULTY_SPEED_FACTOR[difficulty]);
}
