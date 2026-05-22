// src/engine/techniqueAllocator.ts
import { Technique, TechniqueType, PipaNote, Difficulty } from './types';

const TECHNIQUE_SYMBOLS: Record<TechniqueType, string> = {
  tan: '丿', tiao: '丶', lunzhi: '轮', shuangtan: '双',
  sao: '扫', fu: '拂', yaozhi: '摇', yinrou: '吟',
  tuila: '推', chuo: '绰', zhu: '注', fanyin: '〇',
  dai: '带', da: '打', pipa: '琵', guntong: '滚',
};

const TECHNIQUE_CATEGORIES: Record<TechniqueType, 'right' | 'left'> = {
  tan: 'right', tiao: 'right', lunzhi: 'right', shuangtan: 'right',
  sao: 'right', fu: 'right', yaozhi: 'right',
  yinrou: 'left', tuila: 'left', chuo: 'left', zhu: 'left',
  fanyin: 'left', dai: 'left', da: 'left', pipa: 'right', guntong: 'right',
};

const TECHNIQUE_POOLS: Record<Difficulty, TechniqueType[]> = {
  easy: ['tan', 'tiao', 'lunzhi', 'shuangtan'],
  medium: ['tan', 'tiao', 'lunzhi', 'shuangtan', 'yinrou', 'tuila', 'pipa', 'chuo', 'zhu'],
  hard: ['tan', 'tiao', 'lunzhi', 'shuangtan', 'sao', 'fu', 'yaozhi', 'yinrou', 'tuila', 'chuo', 'zhu', 'fanyin', 'dai', 'da', 'pipa', 'guntong'],
};

export function makeTechnique(type: TechniqueType): Technique {
  return {
    type,
    symbol: TECHNIQUE_SYMBOLS[type],
    category: TECHNIQUE_CATEGORIES[type],
  };
}

export function matchTechnique(note: PipaNote, prevNote: PipaNote | null): Technique | null {
  if (note.duration >= 4) return makeTechnique('yinrou');
  if (note.duration >= 2) return makeTechnique('lunzhi');
  if (prevNote && note.pitch - prevNote.pitch >= 7) return makeTechnique('shuangtan');
  if (prevNote && prevNote.pitch - note.pitch >= 1 && prevNote.pitch - note.pitch <= 2) return makeTechnique('chuo');
  if (prevNote && note.pitch - prevNote.pitch >= 1 && note.pitch - prevNote.pitch <= 2) return makeTechnique('zhu');
  if (note.duration <= 0.25 && prevNote && prevNote.technique?.type === 'tan') return makeTechnique('tiao');
  if (!note.isStrongBeat && note.duration <= 0.5 && note.fretPosition >= 5) return makeTechnique('fanyin');
  return null;
}

export function allocateTechniques(
  notes: PipaNote[],
  difficulty: Difficulty,
  measuresPerInsert: number
): PipaNote[] {
  const pool = TECHNIQUE_POOLS[difficulty];
  return notes.map((note, i) => {
    const measureIndex = Math.floor(i / 4);
    if (measureIndex % measuresPerInsert === 0 && i % 2 === 0) {
      const randomType = pool[Math.floor(Math.random() * pool.length)];
      return { ...note, technique: makeTechnique(randomType) };
    }
    return note;
  });
}
