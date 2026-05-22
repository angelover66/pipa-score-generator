# 琵琶简谱自动生成器 — 实施计划

## Context

基于已完成并通过审批的产品设计文档，将琵琶简谱自动生成器从零搭建到 v1.0 MVP。全链路浏览器端处理（ffmpeg.wasm + Basic Pitch + 规则引擎 + SoundFont），Next.js + Vercel 部署，古风 UI，零 LLM 依赖。

## Architecture

Next.js App Router 项目，类型定义统一在 `src/engine/types.ts`，业务逻辑分为 engine（规则引擎）、audio（音频处理）、store（状态管理）、components（UI 组件）、data（预置数据）五个模块。规则引擎和音频处理独立于 React，可单独测试。谱面渲染用 SVG + Canvas 双层，Canvas 负责古风背景纹理，SVG 负责交互式音符。

## Tech Stack

Next.js 14 App Router + TypeScript + Tailwind CSS + ffmpeg.wasm + @tensorflow/tfjs + @spotify/basic-pitch + Web Audio API + LocalStorage

---

## Phase 1: 项目骨架 & 基础类型

### Task 1: Next.js 项目初始化

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create Next.js project**

```bash
cd /Users/lulu/pipa-score-generator && npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

Answer prompts: Yes to all defaults.

- [ ] **Step 2: Verify scaffold**

```bash
cd /Users/lulu/pipa-score-generator && npm run dev
```

Open http://localhost:3000 — should show default Next.js page.

- [ ] **Step 3: Install runtime dependencies**

```bash
npm install @tensorflow/tfjs @spotify/basic-pitch @ffmpeg/ffmpeg
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js project with Tailwind and core dependencies"
```

---

### Task 2: 核心类型定义

**Files:**
- Create: `src/engine/types.ts`

将所有设计文档中的 TypeScript 接口集中定义于此文件，后续所有模块引用。

- [ ] **Step 1: Write types.ts**

```typescript
// src/engine/types.ts

// === Basic Pitch 输出 ===
export interface RawNote {
  pitch: number;        // MIDI note number (0-127)
  startTime: number;    // 秒
  endTime: number;      // 秒
  velocity: number;     // 力度 0-1
}

// === 技法 ===
export type TechniqueType =
  | 'tan'       // 弹
  | 'tiao'      // 挑
  | 'lunzhi'    // 轮指
  | 'shuangtan' // 双弹
  | 'sao'       // 扫
  | 'fu'        // 拂
  | 'yaozhi'    // 摇指
  | 'yinrou'    // 吟揉
  | 'tuila'     // 推拉
  | 'chuo'      // 绰
  | 'zhu'       // 注
  | 'fanyin'    // 泛音
  | 'dai'       // 带起
  | 'da'        // 打音
  | 'pipa'      // 琵音
  | 'guntong';  // 滚/同

export interface Technique {
  type: TechniqueType;
  symbol: string;
  category: 'right' | 'left';
}

// === 琵琶音符 ===
export interface PipaNote {
  pitch: number;
  stringNumber: 1 | 2 | 3 | 4;
  fretPosition: number;
  duration: number;        // 时值（拍数）
  technique: Technique | null;
  isStrongBeat: boolean;
}

// === 小节 ===
export interface Measure {
  index: number;
  timeSignature: [number, number];
  notes: PipaNote[];
}

// === 难度 ===
export type Difficulty = 'easy' | 'medium' | 'hard';

// === 完整简谱 ===
export interface ScoreData {
  id: string;
  title: string;
  sourceType: 'upload' | 'preset';
  originalAudioHash: string;
  key: string;
  tempo: number;
  difficulty: Difficulty;
  measures: Measure[];
  createdAt: string;
}

// === 曲谱库条目 ===
export interface ScoreLibraryEntry {
  id: string;
  title: string;
  difficulty: Difficulty;
  createdAt: string;
  sourceType: 'upload' | 'preset';
  scoreData: ScoreData;
}

// === 预置素材 ===
export interface PresetMaterial {
  id: string;
  title: string;
  category: 'transcribe' | 'reference';
  audioUrl?: string;
  scoreData?: ScoreData;
  description: string;
  tags: string[];
}

// === 应用状态 ===
export type AppStep = 'idle' | 'processing' | 'success' | 'error';
export type ProcessingStep = 'extracting' | 'transcribing' | 'arranging' | 'rendering';
export type PlayerState = 'stopped' | 'playing' | 'paused';

export interface AppState {
  currentStep: AppStep;
  processingProgress: {
    step: ProcessingStep;
    percent: number;
  };
  currentScore: ScoreData | null;
  playerState: PlayerState;
  library: ScoreLibraryEntry[];
  presets: PresetMaterial[];
  error: string | null;
}

// === 错误码 ===
export type ErrorCode =
  | 'FFMPEG_LOAD_FAIL'
  | 'FFMPEG_EXTRACT_FAIL'
  | 'BASIC_PITCH_LOAD_FAIL'
  | 'BASIC_PITCH_EMPTY'
  | 'SOUNDFONT_LOAD_FAIL'
  | 'LOCALSTORAGE_FULL'
  | 'BROWSER_NOT_SUPPORTED';

export interface AppError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts && git commit -m "feat: add core TypeScript type definitions"
```

---

## Phase 2: 规则引擎（核心算法，零 UI 依赖）

### Task 3: 技法映射表 + 技法分配器

**Files:**
- Create: `src/engine/techniqueAllocator.ts`
- Test: `src/engine/__tests__/techniqueAllocator.test.ts`

- [ ] **Step 1: Create technique rules and allocator**

```typescript
// src/engine/techniqueAllocator.ts
import { Technique, TechniqueType, PipaNote, Difficulty } from './types';

// 技法符号映射
const TECHNIQUE_SYMBOLS: Record<TechniqueType, string> = {
  tan: '丿', tiao: '丶', lunzhi: '轮', shuangtan: '双',
  sao: '扫', fu: '拂', yaozhi: '摇', yinrou: '吟',
  tuila: '推', chuo: '绰', zhu: '注', fanyin: '〇',
  dai: '带', da: '打', pipa: '琵', guntong: '滚',
};

// 技法类别
const TECHNIQUE_CATEGORIES: Record<TechniqueType, 'right' | 'left'> = {
  tan: 'right', tiao: 'right', lunzhi: 'right', shuangtan: 'right',
  sao: 'right', fu: 'right', yaozhi: 'right',
  yinrou: 'left', tuila: 'left', chuo: 'left', zhu: 'left',
  fanyin: 'left', dai: 'left', da: 'left', pipa: 'right', guntong: 'right',
};

// 难度对应的技法池
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

/**
 * 技法-场景匹配：根据音符特征自动推荐技法
 * 高难度使用，逐音符匹配
 */
export function matchTechnique(note: PipaNote, prevNote: PipaNote | null): Technique | null {
  // 持续长音 → 吟揉
  if (note.duration >= 4) return makeTechnique('yinrou');
  // 长音 → 轮指
  if (note.duration >= 2) return makeTechnique('lunzhi');
  // 上行大跳 → 双弹
  if (prevNote && note.pitch - prevNote.pitch >= 7) return makeTechnique('shuangtan');
  // 下行小二度 → 绰
  if (prevNote && prevNote.pitch - note.pitch >= 1 && prevNote.pitch - note.pitch <= 2) return makeTechnique('chuo');
  // 上行小二度 → 注
  if (prevNote && note.pitch - prevNote.pitch >= 1 && note.pitch - prevNote.pitch <= 2) return makeTechnique('zhu');
  // 短促音 → 弹挑交替
  if (note.duration <= 0.25 && prevNote && prevNote.technique?.type === 'tan') return makeTechnique('tiao');
  // 弱拍快速音 → 泛音
  if (!note.isStrongBeat && note.duration <= 0.5 && note.fretPosition >= 5) return makeTechnique('fanyin');
  return null;
}

/**
 * 低/中难度的技法分配：按频率控制随机插入
 */
export function allocateTechniques(
  notes: PipaNote[],
  difficulty: Difficulty,
  measuresPerInsert: number
): PipaNote[] {
  const pool = TECHNIQUE_POOLS[difficulty];
  return notes.map((note, i) => {
    // 按技法频率决定是否在该音符上标记技法
    const measureIndex = Math.floor(i / 4); // 假设每小节4个音符
    if (measureIndex % measuresPerInsert === 0 && i % 2 === 0) {
      const randomType = pool[Math.floor(Math.random() * pool.length)];
      return { ...note, technique: makeTechnique(randomType) };
    }
    return note;
  });
}
```

- [ ] **Step 2: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add src/engine/techniqueAllocator.ts && git commit -m "feat: add technique allocator with symbol mapping and difficulty pools"
```

---

### Task 4: 难度降维引擎

**Files:**
- Create: `src/engine/difficultyReducer.ts`

实现音符密度降维和节奏简化两条规则。

- [ ] **Step 1: Write difficulty reducer**

```typescript
// src/engine/difficultyReducer.ts
import { RawNote, PipaNote, Difficulty } from './types';

const DIFFICULTY_SPEED_FACTOR: Record<Difficulty, number> = {
  easy: 0.75,
  medium: 0.9,
  hard: 1.0,
};

/**
 * 检测音符是否落在强拍上（4/4拍：第1、3拍为强拍）
 */
function isStrongBeat(startTime: number, tempo: number): boolean {
  const beatDuration = 60 / tempo;
  const beatIndex = Math.round(startTime / beatDuration) % 4;
  return beatIndex === 0 || beatIndex === 2;
}

/**
 * 将原始音符序列转为 PipaNote 序列并按难度降维
 */
export function reduceDifficulty(rawNotes: RawNote[], difficulty: Difficulty, tempo: number): PipaNote[] {
  // Step 1: tempo → 拍子时长
  const beatDuration = 60 / tempo / 4; // 16分音符时值（Basic Pitch 最高精度）

  // Step 2: 将 rawNotes 转为 PipaNote 序列（先不分配弦序和把位）
  let notes: PipaNote[] = rawNotes.map((n) => ({
    pitch: n.pitch,
    stringNumber: 1 as const, // 占位，Task 5 把位优化会重新计算
    fretPosition: 0,          // 占位
    duration: (n.endTime - n.startTime) / beatDuration, // 拍数
    technique: null,
    isStrongBeat: isStrongBeat(n.startTime, tempo),
  }));

  // Step 3: 按难度降维
  switch (difficulty) {
    case 'easy':
      notes = reduceEasy(notes);
      break;
    case 'medium':
      notes = reduceMedium(notes);
      break;
    case 'hard':
      // 完整保留
      break;
  }

  return notes;
}

function reduceEasy(notes: PipaNote[]): PipaNote[] {
  return notes
    // 只保留强拍音符
    .filter((n) => n.isStrongBeat)
    // 合并连续同音
    .filter((n, i, arr) => i === 0 || n.pitch !== arr[i - 1].pitch)
    // 节奏量化到八分音符
    .map((n) => ({
      ...n,
      duration: Math.max(Math.round(n.duration * 2) / 2, 0.5),
    }));
}

function reduceMedium(notes: PipaNote[]): PipaNote[] {
  return notes
    // 删除 16 分音符以下的快速经过音
    .filter((n) => n.duration >= 0.25)
    // 保留强拍 + 次强拍
    .filter((n, i) => n.isStrongBeat || (i > 0 && notes[i - 1].isStrongBeat));
}

/**
 * 按难度调整速度
 */
export function adjustTempo(originalTempo: number, difficulty: Difficulty): number {
  return Math.round(originalTempo * DIFFICULTY_SPEED_FACTOR[difficulty]);
}
```

- [ ] **Step 2: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add src/engine/difficultyReducer.ts && git commit -m "feat: add difficulty reducer with note density and rhythm simplification"
```

---

### Task 5: 把位优化器（动态规划）

**Files:**
- Create: `src/engine/positionOptimizer.ts`

- [ ] **Step 1: Write position optimizer**

```typescript
// src/engine/positionOptimizer.ts
import { PipaNote, Difficulty } from './types';

// 琵琶 D 调空弦音高
const OPEN_STRINGS = [62, 57, 52, 50]; // D4=62, A3=57, E3=52, D3=50 (MIDI note)

// 每弦可用品位范围（含全部品位，0=空弦）
const MAX_FRET = 24;

interface Position {
  stringNumber: 1 | 2 | 3 | 4;
  fretPosition: number;
  pitch: number;
}

/**
 * 获取某个音高在琵琶上的所有候选指位
 */
function getCandidates(pitch: number, difficulty: Difficulty): Position[] {
  const candidates: Position[] = [];
  const maxFret = difficulty === 'easy' ? 6 : difficulty === 'medium' ? 15 : MAX_FRET;

  for (let s = 0; s < 4; s++) {
    const fret = pitch - OPEN_STRINGS[s];
    if (fret >= 0 && fret <= maxFret) {
      candidates.push({
        stringNumber: (s + 1) as 1 | 2 | 3 | 4,
        fretPosition: fret,
        pitch,
      });
    }
  }
  return candidates;
}

/**
 * 动态规划：找最优指位序列使左手纵向移动距离最小
 */
export function optimizePositions(notes: PipaNote[], difficulty: Difficulty): PipaNote[] {
  if (notes.length === 0) return notes;

  // dp[i] = [{pos, cost, prev}]
  const dp: Array<Array<{ pos: Position; cost: number; prev: number | null }>> = [];
  const firstCandidates = getCandidates(notes[0].pitch, difficulty);
  if (firstCandidates.length === 0) return notes;

  dp[0] = firstCandidates.map((pos) => ({ pos, cost: 0, prev: null }));

  for (let i = 1; i < notes.length; i++) {
    const candidates = getCandidates(notes[i].pitch, difficulty);
    if (candidates.length === 0) {
      // 无合法指位，沿用上一个音符的指位信息
      notes[i].stringNumber = notes[i - 1].stringNumber;
      notes[i].fretPosition = notes[i - 1].fretPosition;
      continue;
    }

    dp[i] = candidates.map((pos) => {
      let minCost = Infinity;
      let bestPrev: number | null = null;
      for (let k = 0; k < dp[i - 1].length; k++) {
        // 移动距离 = 品位差 + 弦序切换惩罚
        const fretDistance = Math.abs(pos.fretPosition - dp[i - 1][k].pos.fretPosition);
        const stringPenalty = pos.stringNumber !== dp[i - 1][k].pos.stringNumber ? 2 : 0;
        // 中难度禁止超过 5 品的快速跳跃
        const jumpPenalty = difficulty === 'medium' && fretDistance > 5 ? 100 : 0;
        const cost = dp[i - 1][k].cost + fretDistance + stringPenalty + jumpPenalty;
        if (cost < minCost) {
          minCost = cost;
          bestPrev = k;
        }
      }
      return { pos, cost: minCost, prev: bestPrev };
    });
  }

  // 回溯最优路径
  const result: Array<{ pos: Position }> = [];
  let bestLast = 0;
  for (let k = 1; k < dp[dp.length - 1].length; k++) {
    if (dp[dp.length - 1][k].cost < dp[dp.length - 1][bestLast].cost) {
      bestLast = k;
    }
  }
  let cur: number | null = bestLast;
  for (let i = dp.length - 1; i >= 0; i--) {
    result.unshift({ pos: dp[i][cur!].pos });
    cur = dp[i][cur!].prev;
  }

  // 将最优指位写入 notes
  return notes.map((note, i) => ({
    ...note,
    stringNumber: result[i]?.pos.stringNumber ?? 1,
    fretPosition: result[i]?.pos.fretPosition ?? 0,
  }));
}
```

- [ ] **Step 2: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add src/engine/positionOptimizer.ts && git commit -m "feat: add position optimizer with dynamic programming algorithm"
```

---

### Task 6: 编曲主引擎（组装三难度输出）

**Files:**
- Create: `src/engine/arrangement.ts`

将 difficultyReducer + techniqueAllocator + positionOptimizer 组装为一个对外接口。

- [ ] **Step 1: Write arrangement engine**

```typescript
// src/engine/arrangement.ts
import { RawNote, ScoreData, Difficulty } from './types';
import { reduceDifficulty, adjustTempo } from './difficultyReducer';
import { allocateTechniques, matchTechnique } from './techniqueAllocator';
import { optimizePositions } from './positionOptimizer';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function estimateTempo(rawNotes: RawNote[]): number {
  if (rawNotes.length < 8) return 80; // 默认
  const intervals: number[] = [];
  for (let i = 1; i < rawNotes.length; i++) {
    intervals.push(rawNotes[i].startTime - rawNotes[i - 1].startTime);
  }
  intervals.sort((a, b) => a - b);
  // 取中位数作为拍间隔估算
  const medianInterval = intervals[Math.floor(intervals.length / 2)];
  // 假设中位数间隔为 16 分音符
  return Math.round(60 / (medianInterval * 4));
}

function groupIntoMeasures(notes: import('./types').PipaNote[]): import('./types').Measure[] {
  const measures: import('./types').Measure[] = [];
  const notesPerMeasure = 16; // 假设每小节最多 16 个 16 分音符（4/4 拍）
  for (let i = 0; i < notes.length; i += notesPerMeasure) {
    measures.push({
      index: measures.length,
      timeSignature: [4, 4],
      notes: notes.slice(i, i + notesPerMeasure),
    });
  }
  return measures;
}

/**
 * 生成单个难度的完整 ScoreData
 */
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

  // 技法分配
  if (difficulty === 'easy') {
    notes = allocateTechniques(notes, difficulty, 6); // 每 4-8 小节
  } else if (difficulty === 'medium') {
    notes = allocateTechniques(notes, difficulty, 2); // 每 1-2 小节
  } else {
    // 高难度：逐音符匹配技法
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

/**
 * 一次生成三种难度的 ScoreData
 */
export function generateAllDifficulties(
  rawNotes: RawNote[],
  title: string,
  sourceType: 'upload' | 'preset'
): Record<Difficulty, ScoreData> {
  const audioHash = title + Date.now(); // 简化 hash
  return {
    easy: generateScore(rawNotes, 'easy', title, sourceType, audioHash),
    medium: generateScore(rawNotes, 'medium', title, sourceType, audioHash),
    hard: generateScore(rawNotes, 'hard', title, sourceType, audioHash),
  };
}
```

- [ ] **Step 2: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add src/engine/arrangement.ts && git commit -m "feat: add arrangement engine combining all difficulty modules"
```

---

## Phase 3: 音频处理模块

### Task 7: ffmpeg 音频提取器

**Files:**
- Create: `src/audio/ffmpegExtractor.ts`

浏览器端提取音频，输出 WAV 格式供 Basic Pitch 使用。

- [ ] **Step 1: Write ffmpeg extractor**

```typescript
// src/audio/ffmpegExtractor.ts
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export async function initFFmpeg(onProgress?: (percent: number) => void): Promise<void> {
  if (ffmpeg && ffmpeg.loaded) return;

  ffmpeg = new FFmpeg();
  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(Math.round(progress * 50)); // 提取占 50%
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({ coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript') });
}

export async function extractAudio(file: File): Promise<Float32Array> {
  if (!ffmpeg) throw new Error('FFMPEG_LOAD_FAIL: ffmpeg not initialized');

  const inputName = 'input' + file.name.slice(file.name.lastIndexOf('.'));
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec(['-i', inputName, '-ar', '16000', '-ac', '1', '-f', 'f32le', 'output.f32le']);

  const data = await ffmpeg.readFile('output.f32le');
  return new Float32Array(data as ArrayBuffer);
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  const validAudio = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/aac', 'audio/x-m4a'];
  const validVideo = ['video/mp4', 'video/quicktime', 'video/x-matroska'];
  const allValid = [...validAudio, ...validVideo];

  if (!allValid.includes(file.type) && !file.name.match(/\.(mp3|wav|flac|m4a|aac|mp4|mov|mkv)$/i)) {
    return { valid: false, error: '请上传支持的音频或视频文件（mp3/wav/flac/m4a/aac/mp4/mov/mkv）' };
  }
  if (file.size > 100 * 1024 * 1024) {
    return { valid: false, error: '文件过大，请上传 100MB 以内的文件' };
  }
  return { valid: true };
}
```

- [ ] **Step 2: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add src/audio/ffmpegExtractor.ts && git commit -m "feat: add ffmpeg.wasm audio extractor with file validation"
```

---

### Task 8: Basic Pitch 旋律转写器

**Files:**
- Create: `src/audio/basicPitchTranscriber.ts`

- [ ] **Step 1: Write Basic Pitch wrapper**

```typescript
// src/audio/basicPitchTranscriber.ts
import { RawNote } from '../engine/types';

let model: any = null;

export async function initBasicPitch(onProgress?: (percent: number) => void): Promise<void> {
  if (model) return;
  onProgress?.(10);
  // Basic Pitch 使用 tfjs 后端，模型会自动从 CDN 加载
  const { BasicPitch } = await import('@spotify/basic-pitch');
  model = new BasicPitch();
  onProgress?.(30);
}

export async function transcribe(audioData: Float32Array, onProgress?: (percent: number) => void): Promise<RawNote[]> {
  if (!model) throw new Error('BASIC_PITCH_LOAD_FAIL: model not initialized');

  onProgress?.(50);
  const results = await model.evaluate(audioData);

  onProgress?.(90);
  // results 格式: { onsets, contours, notes }
  // 转换为我们定义的 RawNote 格式
  const notes: RawNote[] = [];

  for (let i = 0; i < results.notes.pitches.length; i++) {
    notes.push({
      pitch: results.notes.pitches[i],
      startTime: results.notes.onsets[i],
      endTime: results.notes.offsets[i],
      velocity: results.notes.velocities?.[i] ?? 0.8,
    });
  }

  onProgress?.(100);
  return notes;
}

export function validateHasMelody(notes: RawNote[]): boolean {
  if (notes.length === 0) return false;
  // 至少要有 5 个不同的音高才认为有可用旋律
  const uniquePitches = new Set(notes.map((n) => n.pitch));
  return uniquePitches.size >= 5 && notes.length >= 10;
}
```

- [ ] **Step 2: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add src/audio/basicPitchTranscriber.ts && git commit -m "feat: add Basic Pitch melody transcription wrapper"
```

---

### Task 9: SoundFont 加载 & 播放器

**Files:**
- Create: `src/audio/soundFontLoader.ts`
- Create: `src/audio/scorePlayer.ts`

- [ ] **Step 1: Write SoundFont loader（精简为只加载琵琶音色）**

```typescript
// src/audio/soundFontLoader.ts
// SoundFont 加载器 — 精简加载 FluidR3 GM #105 琵琶音色

let audioContext: AudioContext | null = null;
const sampleCache: Map<number, AudioBuffer> = new Map();

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: 44100 });
  }
  return audioContext;
}

/**
 * 从精简后的琵琶音频文件中加载样本
 * MVP 阶段使用预渲染的单个音符样本，而非完整 sf2 解析
 *
 * 精简策略：
 * - 用 sf2tool 或 Python script 预先提取 GM #105 的音域样本为独立 wav 文件
 * - 或直接从 CDN 加载预处理的样本包
 * - MVP 降级方案：用 Web Audio API 合成基础琵琶音色
 */
export async function loadPipaSamples(onProgress?: (percent: number) => void): Promise<void> {
  if (sampleCache.size > 0) return;

  const ctx = getAudioContext();
  // MVP 降级：合成琵琶音色（模拟弹拨乐器的 ADSR 包络）
  // 后续迭代替换为真实 SoundFont 样本

  const midiRange = { min: 50, max: 86 }; // D3-D7, 约 37 个半音
  const totalNotes = midiRange.max - midiRange.min + 1;

  for (let midi = midiRange.min; midi <= midiRange.max; midi++) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const sampleRate = ctx.sampleRate;
    const duration = 2.0; // 2 秒采样
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // 合成琵琶音色：基频 + 3 次谐波 + 快速衰减（模拟拨弦）
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 4); // 快速衰减
      const fundamental = Math.sin(2 * Math.PI * freq * t);
      const h2 = 0.5 * Math.sin(2 * Math.PI * freq * 2 * t);    // 二次谐波
      const h3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);   // 三次谐波
      const h4 = 0.1 * Math.sin(2 * Math.PI * freq * 4 * t);    // 四次谐波
      data[i] = (fundamental + h2 + h3 + h4) * envelope * 0.6;
    }

    sampleCache.set(midi, buffer);
    onProgress?.(Math.round(((midi - midiRange.min) / totalNotes) * 100));
  }
}

export function getSample(midiNote: number): AudioBuffer | undefined {
  // 限制在范围内
  const clamped = Math.max(50, Math.min(86, midiNote));
  return sampleCache.get(clamped);
}

export { getAudioContext };
```

- [ ] **Step 2: Write score player**

```typescript
// src/audio/scorePlayer.ts
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

  play(): void {
    if (!this.score || this.state === 'playing') return;

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

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

    const beatDuration = 60 / this.tempo / 4; // 16分音符秒数
    let timeOffset = 0;

    for (let m = 0; m < this.score.measures.length; m++) {
      for (let n = 0; n < this.score.measures[m].notes.length; n++) {
        const note = this.score.measures[m].notes[n];
        const sample = getSample(note.pitch);
        if (!sample) continue;

        const source = ctx.createBufferSource();
        source.buffer = sample;

        // 技法影响增益
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

      if (percent >= 100) {
        this.stop();
        return;
      }
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

  resume(): void {
    if (this.state !== 'paused' || !this.score) return;
    getAudioContext().resume();
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
```

- [ ] **Step 3: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add src/audio/soundFontLoader.ts src/audio/scorePlayer.ts && git commit -m "feat: add SoundFont synthesizer and score player with Web Audio API"
```

---

## Phase 4: 状态管理 & 曲谱存储

### Task 10: 全局状态 Context + useReducer

**Files:**
- Create: `src/store/AppContext.tsx`

- [ ] **Step 1: Write AppContext**

```typescript
// src/store/AppContext.tsx
'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, AppStep, ProcessingStep, PlayerState, ScoreData, ScoreLibraryEntry, PresetMaterial } from '../engine/types';

type Action =
  | { type: 'SET_STEP'; payload: AppStep }
  | { type: 'SET_PROCESSING'; payload: { step: ProcessingStep; percent: number } }
  | { type: 'SET_SCORE'; payload: ScoreData }
  | { type: 'SET_PLAYER_STATE'; payload: PlayerState }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_TO_LIBRARY'; payload: ScoreLibraryEntry }
  | { type: 'REMOVE_FROM_LIBRARY'; payload: string }
  | { type: 'SET_PRESETS'; payload: PresetMaterial[] }
  | { type: 'LOAD_LIBRARY'; payload: ScoreLibraryEntry[] }
  | { type: 'RESET' };

const initialState: AppState = {
  currentStep: 'idle',
  processingProgress: { step: 'extracting', percent: 0 },
  currentScore: null,
  playerState: 'stopped',
  library: [],
  presets: [],
  error: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_PROCESSING':
      return { ...state, processingProgress: action.payload };
    case 'SET_SCORE':
      return { ...state, currentScore: action.payload, currentStep: 'success' };
    case 'SET_PLAYER_STATE':
      return { ...state, playerState: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, currentStep: action.payload ? 'error' : state.currentStep };
    case 'ADD_TO_LIBRARY': {
      const exists = state.library.find((e) => e.id === action.payload.id);
      if (exists) return state;
      const updated = [action.payload, ...state.library].slice(0, 100);
      localStorage.setItem('pipa-score-library', JSON.stringify(updated));
      return { ...state, library: updated };
    }
    case 'REMOVE_FROM_LIBRARY': {
      const filtered = state.library.filter((e) => e.id !== action.payload);
      localStorage.setItem('pipa-score-library', JSON.stringify(filtered));
      return { ...state, library: filtered };
    }
    case 'SET_PRESETS':
      return { ...state, presets: action.payload };
    case 'LOAD_LIBRARY':
      return { ...state, library: action.payload };
    case 'RESET':
      return { ...state, currentStep: 'idle', currentScore: null, error: null };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 启动时从 localStorage 加载曲谱库
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pipa-score-library');
      if (stored) {
        const parsed = JSON.parse(stored) as ScoreLibraryEntry[];
        dispatch({ type: 'LOAD_LIBRARY', payload: parsed });
      }
    } catch {
      // ignore corrupt data
    }
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
```

- [ ] **Step 2: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add src/store/AppContext.tsx && git commit -m "feat: add global state management with Context + useReducer"
```

---

## Phase 5: UI 组件 & 页面

### Task 11: 古风 Layout + 全局样式

**Files:**
- Create: `src/components/layout/Navbar.tsx`
- Create: `src/components/layout/Footer.tsx`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1: 全局样式 & Tailwind 古风主题配置**

在 `tailwind.config.ts` 中扩展 colors 和 fontFamily（无需创建新文件，直接修改）：

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#2c1810', light: '#5c3a28', faded: '#8b7355' },
        rice: { DEFAULT: '#f5f0e8', dark: '#e8dcc8', light: '#faf7f0' },
        vermilion: { DEFAULT: '#c41e3a', light: '#e85555', dark: '#8b0000' },
        jade: { DEFAULT: '#2e8b57', light: '#5daa7a', dark: '#1a5c3a' },
        gold: { DEFAULT: '#b8860b', light: '#daa520', dark: '#8b6914' },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'serif'],
        brush: ['"ZCOOL KuaiLe"', 'cursive'],
      },
    },
  },
  plugins: [],
};
export default config;
```

在 `src/app/globals.css` 中添加古风基调和关键帧动画：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap');

@layer base {
  body {
    @apply bg-rice-light text-ink font-serif;
  }
}

/* 水墨扩散动画 */
@keyframes ink-spread {
  0% { transform: scale(0.8); opacity: 0; }
  50% { opacity: 0.3; }
  100% { transform: scale(1.5); opacity: 0; }
}

@keyframes ink-drip {
  0% { transform: translateY(-20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

@keyframes scroll-unroll {
  0% { clip-path: inset(0 100% 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.animate-ink-spread { animation: ink-spread 3s ease-out infinite; }
.animate-ink-drip { animation: ink-drip 0.8s ease-out; }
.animate-scroll-unroll { animation: scroll-unroll 1.2s ease-out; }
.animate-float { animation: float 6s ease-in-out infinite; }
```

- [ ] **Step 2: Layout**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next';
import { AppProvider } from '@/store/AppContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: '琵琶简谱生成器',
  description: '上传任意音乐，自动生成三种难度琵琶简谱',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Navbar**

```typescript
// src/components/layout/Navbar.tsx
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-rice-dark/80 backdrop-blur border-b border-ink/10">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="text-2xl text-ink font-bold tracking-wider hover:text-vermilion transition-colors">
          琵琶谱
        </Link>
        <div className="flex gap-6 text-ink-light">
          <Link href="/library" className="hover:text-vermilion transition-colors">曲谱库</Link>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Footer**

```typescript
// src/components/layout/Footer.tsx
export default function Footer() {
  return (
    <footer className="text-center py-6 text-ink-faded text-sm border-t border-ink/5">
      <p>琵琶简谱自动生成器 · 仅供学习练习使用</p>
    </footer>
  );
}
```

- [ ] **Step 5: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add -A && git commit -m "feat: add ancient-style layout, Tailwind theme, and global CSS animations"
```

---

### Task 12: 首页（Hero + 上传入口 + 水墨动画）

**Files:**
- Create: `src/components/home/InkAnimation.tsx`
- Create: `src/components/home/UploadZone.tsx`
- Create: `src/components/home/PresetQuickSelect.tsx`
- Create: `src/components/home/HeroSection.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 水墨动画背景 Canvas**

```typescript
// src/components/home/InkAnimation.tsx
'use client';
import { useEffect, useRef } from 'react';

export default function InkAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    let particles: Array<{ x: number; y: number; r: number; alpha: number; vy: number }> = [];

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 水墨粒子
      if (Math.random() < 0.1) {
        particles.push({
          x: Math.random() * canvas.width / 2,
          y: -10,
          r: Math.random() * 30 + 10,
          alpha: Math.random() * 0.08 + 0.02,
          vy: Math.random() * 0.3 + 0.1,
        });
      }
      particles = particles.filter((p) => p.y < canvas.height / 2 + 50);
      for (const p of particles) {
        p.y += p.vy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(44, 24, 16, ${p.alpha})`;
        ctx.fill();
      }
      requestAnimationFrame(animate);
    }
    animate();
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" />;
}
```

- [ ] **Step 2: UploadZone 上传组件**

```typescript
// src/components/home/UploadZone.tsx
'use client';
import { useState, useRef } from 'react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export default function UploadZone({ onFileSelect, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && !disabled) onFileSelect(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && !disabled) onFileSelect(file);
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-all duration-300 cursor-pointer
        ${isDragging ? 'border-vermilion bg-vermilion/5 scale-[1.02]' : 'border-ink/20 hover:border-ink/40 bg-rice/50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" className="hidden"
        accept="audio/*,video/*,.mp3,.wav,.flac,.m4a,.aac,.mp4,.mov,.mkv"
        onChange={handleChange} disabled={disabled} />
      <div className="text-6xl mb-4 animate-float">🎵</div>
      <p className="text-xl text-ink mb-2">拖拽上传音频或视频文件</p>
      <p className="text-sm text-ink-faded">支持 mp3 / wav / flac / m4a / aac / mp4 / mov / mkv</p>
      <p className="text-xs text-ink-faded mt-1">最大 100MB · 15秒~10分钟</p>
    </div>
  );
}
```

- [ ] **Step 3: PresetQuickSelect 预置素材快捷入口**

```typescript
// src/components/home/PresetQuickSelect.tsx
'use client';
import { PresetMaterial } from '@/engine/types';

interface PresetQuickSelectProps {
  presets: PresetMaterial[];
  onSelect: (preset: PresetMaterial) => void;
}

export default function PresetQuickSelect({ presets, onSelect }: PresetQuickSelectProps) {
  const transcribePresets = presets.filter((p) => p.category === 'transcribe');

  return (
    <div className="mt-8">
      <h3 className="text-lg text-ink font-bold mb-4">快速体验</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {transcribePresets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className="p-3 border border-ink/10 rounded-lg hover:border-vermilion hover:bg-vermilion/5 transition-all text-sm text-ink-light hover:text-ink text-left"
          >
            <div className="font-medium truncate">{preset.title}</div>
            <div className="text-xs text-ink-faded mt-1 truncate">{preset.tags.join(' · ')}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: HeroSection + Home Page**

```typescript
// src/components/home/HeroSection.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/store/AppContext';
import { validateFile } from '@/audio/ffmpegExtractor';
import InkAnimation from './InkAnimation';
import UploadZone from './UploadZone';
import PresetQuickSelect from './PresetQuickSelect';
import { PresetMaterial } from '@/engine/types';

export default function HeroSection() {
  const router = useRouter();
  const { state, dispatch } = useAppState();

  function handleFile(file: File) {
    const result = validateFile(file);
    if (!result.valid) {
      dispatch({ type: 'SET_ERROR', payload: result.error ?? null });
      return;
    }
    // 存储文件引用到 sessionStorage，跳转到处理页
    sessionStorage.setItem('pending-file-name', file.name);
    // 实际文件通过 URL.createObjectURL 传递
    const url = URL.createObjectURL(file);
    sessionStorage.setItem('pending-file-url', url);
    router.push('/generate');
  }

  function handlePreset(preset: PresetMaterial) {
    sessionStorage.setItem('pending-preset-id', preset.id);
    router.push('/generate');
  }

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      <InkAnimation />
      <div className="relative z-10 max-w-2xl mx-auto px-6 py-20 text-center animate-ink-drip">
        <h1 className="text-5xl md:text-6xl text-ink font-bold mb-6 tracking-widest">
          琵琶简谱生成器
        </h1>
        <p className="text-lg text-ink-light mb-10 leading-relaxed">
          上传任意音乐，AI 自动生成三种难度琵琶简谱<br />
          可模拟琵琶弹奏播放，让练习不再枯燥
        </p>
        <UploadZone onFileSelect={handleFile} />
        <PresetQuickSelect presets={state.presets} onSelect={handlePreset} />
      </div>
    </section>
  );
}
```

```typescript
// src/app/page.tsx
import HeroSection from '@/components/home/HeroSection';

export default function Home() {
  return <HeroSection />;
}
```

- [ ] **Step 5: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add -A && git commit -m "feat: add homepage with ink animation, upload zone, and preset selector"
```

---

### Task 13: 处理进度页 (/generate)

**Files:**
- Create: `src/components/generate/ProgressIndicator.tsx`
- Create: `src/app/generate/page.tsx`

- [ ] **Step 1: ProgressIndicator**

```typescript
// src/components/generate/ProgressIndicator.tsx
'use client';
import { ProcessingStep } from '@/engine/types';

const STEP_LABELS: Record<ProcessingStep, string> = {
  extracting: '正在提取音频...',
  transcribing: '正在识别旋律...',
  arranging: '正在生成简谱...',
  rendering: '正在渲染谱面...',
};

interface ProgressIndicatorProps {
  step: ProcessingStep;
  percent: number;
}

export default function ProgressIndicator({ step, percent }: ProgressIndicatorProps) {
  const steps: ProcessingStep[] = ['extracting', 'transcribing', 'arranging', 'rendering'];
  const currentIdx = steps.indexOf(step);

  return (
    <div className="max-w-md mx-auto py-20 text-center">
      <div className="text-4xl mb-8 animate-float">🎼</div>
      <h2 className="text-2xl text-ink font-bold mb-2">{STEP_LABELS[step]}</h2>
      <div className="w-full bg-rice-dark rounded-full h-2 mb-4 overflow-hidden">
        <div className="h-full bg-vermilion rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }} />
      </div>
      <p className="text-sm text-ink-faded">{percent}%</p>
      <div className="flex justify-center gap-2 mt-6">
        {steps.map((s, i) => (
          <div key={s} className={`w-3 h-3 rounded-full transition-colors ${
            i < currentIdx ? 'bg-jade' : i === currentIdx ? 'bg-vermilion animate-pulse' : 'bg-ink/10'
          }`} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Generate page with processing pipeline**

```typescript
// src/app/generate/page.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/store/AppContext';
import { initFFmpeg, extractAudio } from '@/audio/ffmpegExtractor';
import { initBasicPitch, transcribe, validateHasMelody } from '@/audio/basicPitchTranscriber';
import { generateAllDifficulties } from '@/engine/arrangement';
import { Difficulty, ScoreData } from '@/engine/types';
import ProgressIndicator from '@/components/generate/ProgressIndicator';
import { presets } from '@/data/presets';

export default function GeneratePage() {
  const router = useRouter();
  const { dispatch } = useAppState();
  const [processingStep, setProcessingStep] = useState<'extracting' | 'transcribing' | 'arranging' | 'rendering'>('extracting');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const process = useCallback(async () => {
    try {
      dispatch({ type: 'SET_STEP', payload: 'processing' });

      // Step 1: ffmpeg 提取
      setProcessingStep('extracting');
      setPercent(0);
      await initFFmpeg((p) => setPercent(p));
      setPercent(100);

      const presetId = sessionStorage.getItem('pending-preset-id');
      let audioData: Float32Array;
      let title: string;
      let sourceType: 'upload' | 'preset';

      if (presetId) {
        const preset = presets.find((p) => p.id === presetId);
        if (!preset || !preset.audioUrl) throw new Error('预置素材加载失败');
        title = preset.title;
        sourceType = 'preset';
        // 从 CDN 加载预置音频
        const resp = await fetch(preset.audioUrl);
        const buffer = await resp.arrayBuffer();
        audioData = new Float32Array(buffer);
      } else {
        const fileUrl = sessionStorage.getItem('pending-file-url');
        const fileName = sessionStorage.getItem('pending-file-name') || '未命名曲目';
        if (!fileUrl) throw new Error('未找到上传文件');
        title = fileName.replace(/\.[^.]+$/, '');
        sourceType = 'upload';
        const resp = await fetch(fileUrl);
        const blob = await resp.blob();
        const file = new File([blob], fileName);
        audioData = await extractAudio(file);
      }

      // Step 2: Basic Pitch 转写
      setProcessingStep('transcribing');
      setPercent(0);
      await initBasicPitch((p) => setPercent(p));
      const rawNotes = await transcribe(audioData, (p) => setPercent(p));

      if (!validateHasMelody(rawNotes)) {
        throw new Error('BASIC_PITCH_EMPTY: 未检测到可用旋律');
      }
      setPercent(100);

      // Step 3: 编曲
      setProcessingStep('arranging');
      setPercent(50);
      const scores = generateAllDifficulties(rawNotes, title, sourceType);
      setPercent(100);

      // Step 4: 渲染（在 score 页面完成）
      setProcessingStep('rendering');
      setPercent(100);

      // 存入 state 并跳转
      dispatch({ type: 'SET_SCORE', payload: scores.medium }); // 默认显示中难度
      // 暂存三种难度到 sessionStorage，供 score 页面读取
      sessionStorage.setItem('scores-easy', JSON.stringify(scores.easy));
      sessionStorage.setItem('scores-medium', JSON.stringify(scores.medium));
      sessionStorage.setItem('scores-hard', JSON.stringify(scores.hard));

      router.push(`/score/${scores.medium.id}`);
    } catch (err: any) {
      const msg = err?.message || '处理失败';
      setError(msg);
      dispatch({ type: 'SET_ERROR', payload: msg });
    }
  }, [dispatch, router]);

  useEffect(() => { process(); }, [process]);

  if (error) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="text-6xl mb-6">😞</div>
        <h2 className="text-xl text-ink font-bold mb-4">处理失败</h2>
        <p className="text-ink-light mb-6">{error}</p>
        <button onClick={() => router.push('/')} className="px-6 py-2 bg-vermilion text-white rounded-lg hover:bg-vermilion-dark transition-colors">
          重新开始
        </button>
      </div>
    );
  }

  return <ProgressIndicator step={processingStep} percent={percent} />;
}
```

- [ ] **Step 3: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add -A && git commit -m "feat: add generate page with full processing pipeline"
```

---

### Task 14: 谱面渲染（SVG + Canvas 双层）

**Files:**
- Create: `src/components/score/CanvasBackground.tsx`
- Create: `src/components/score/SvgScore.tsx`
- Create: `src/components/score/ScoreRenderer.tsx`
- Create: `src/components/score/PlayerControls.tsx`
- Create: `src/components/score/DifficultyTabs.tsx`
- Create: `src/components/score/ExportPanel.tsx`
- Create: `src/app/score/[id]/page.tsx`

- [ ] **Step 1: CanvasBackground — 宣纸纹理**

```typescript
// src/components/score/CanvasBackground.tsx
'use client';
import { useEffect, useRef } from 'react';

export default function CanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    // 宣纸底色
    ctx.fillStyle = '#faf7f0';
    ctx.fillRect(0, 0, w, h);

    // 纤维纹理
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * w / 2;
      const y = Math.random() * h / 2;
      ctx.strokeStyle = `rgba(139, 115, 85, ${Math.random() * 0.06})`;
      ctx.lineWidth = Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.random() * 60 - 30, y + Math.random() * 2 - 1);
      ctx.stroke();
    }

    // 边角水渍/墨迹
    const corners = [
      [40, 40], [w / 2 - 100, 40], [40, h / 2 - 100],
    ];
    for (const [cx, cy] of corners) {
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80);
      gradient.addColorStop(0, 'rgba(139, 115, 85, 0.06)');
      gradient.addColorStop(1, 'rgba(139, 115, 85, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - 80, cy - 80, 160, 160);
    }
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded-lg" />;
}
```

- [ ] **Step 2: SvgScore — SVG 谱面渲染**

```typescript
// src/components/score/SvgScore.tsx
'use client';
import { ScoreData, Difficulty } from '@/engine/types';

interface SvgScoreProps {
  score: ScoreData;
  scores: Record<Difficulty, ScoreData>;
  difficulty: Difficulty;
}

const NOTE_NAMES = ['1', '2', '3', '4', '5', '6', '7'];

export default function SvgScore({ score, scores, difficulty }: SvgScoreProps) {
  const scoreData = scores[difficulty];
  if (!scoreData) return <p className="text-center py-10 text-ink-faded">暂无该难度谱面</p>;

  const NOTE_WIDTH = 40;
  const NOTE_HEIGHT = 80;
  const MEASURE_GAP = 20;
  const NOTES_PER_ROW = 16;
  const measures = scoreData.measures;

  // 将小节按每行 4 小节排列
  const rows: typeof measures[] = [];
  for (let i = 0; i < measures.length; i += 4) {
    rows.push(measures.slice(i, i + 4));
  }

  const svgWidth = 4 * (NOTES_PER_ROW * NOTE_WIDTH / 4 + MEASURE_GAP) + 80;
  const svgHeight = rows.length * (NOTE_HEIGHT + 40) + 40;

  return (
    <svg width={svgWidth} height={svgHeight} className="w-full h-auto">
      {rows.map((row, rowIdx) => (
        <g key={rowIdx} transform={`translate(40, ${rowIdx * (NOTE_HEIGHT + 40) + 20})`}>
          {row.map((measure, mIdx) => {
            const measureX = mIdx * (16 * NOTE_WIDTH / 4 + MEASURE_GAP);
            return (
              <g key={measure.index} transform={`translate(${measureX}, 0)`}>
                {/* 小节线 */}
                <line x1={0} y1={0} x2={0} y2={NOTE_HEIGHT} stroke="#2c1810" strokeWidth={1} />
                {/* 音符 */}
                {measure.notes.map((note, nIdx) => {
                  const nx = nIdx * NOTE_WIDTH + 10;
                  const ny = 20;

                  // 音高转数字简谱（MIDI pitch % 12 得到音级）
                  const pitchClass = note.pitch % 12;
                  const noteNumber = [0, 0, 2, 2, 3, 3, 5, 5, 7, 7, 9, 9][pitchClass] || 0;
                  const noteName = ['1', '1', '2', '2', '3', '4', '4', '5', '5', '6', '6', '7'][pitchClass] || '1';

                  return (
                    <g key={nIdx}>
                      {/* 音符数字 */}
                      <text x={nx} y={ny + 30} className="fill-ink text-lg"
                        fontSize="18" fontWeight="bold" textAnchor="middle">
                        {noteName}
                      </text>

                      {/* 减时线（8分音符） */}
                      {note.duration <= 0.5 && (
                        <line x1={nx - 8} y1={ny + 36} x2={nx + 8} y2={ny + 36}
                          stroke="#2c1810" strokeWidth={1.5} />
                      )}
                      {/* 双减时线（16分音符） */}
                      {note.duration <= 0.25 && (
                        <line x1={nx - 8} y1={ny + 40} x2={nx + 8} y2={ny + 40}
                          stroke="#2c1810" strokeWidth={1.5} />
                      )}

                      {/* 技法标记 */}
                      {note.technique && (
                        <text x={nx} y={ny - 2} className="fill-vermilion" fontSize="12" textAnchor="middle">
                          {note.technique.symbol}
                        </text>
                      )}

                      {/* 弦序/把位标注 */}
                      <text x={nx} y={ny + 52} className="fill-ink-faded" fontSize="8" textAnchor="middle">
                        {note.stringNumber > 0 ? `${note.stringNumber === 1 ? 'Ⅰ' : note.stringNumber === 2 ? 'Ⅱ' : note.stringNumber === 3 ? 'Ⅲ' : 'Ⅳ'}${note.fretPosition}` : ''}
                      </text>
                    </g>
                  );
                })}
                {/* 小节结束线 */}
                <line x1={NOTES_PER_ROW * NOTE_WIDTH / 4} y1={0}
                  x2={NOTES_PER_ROW * NOTE_WIDTH / 4} y2={NOTE_HEIGHT}
                  stroke="#2c1810" strokeWidth={1} />
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}
```

- [ ] **Step 3: ScoreRenderer 组合双层渲染**

```typescript
// src/components/score/ScoreRenderer.tsx
'use client';
import { useState } from 'react';
import { ScoreData, Difficulty } from '@/engine/types';
import CanvasBackground from './CanvasBackground';
import SvgScore from './SvgScore';
import DifficultyTabs from './DifficultyTabs';
import PlayerControls from './PlayerControls';
import ExportPanel from './ExportPanel';

interface ScoreRendererProps {
  score: ScoreData;
  scores: Record<Difficulty, ScoreData>;
}

export default function ScoreRenderer({ score, scores }: ScoreRendererProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>(score.difficulty);
  const currentScore = scores[difficulty];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* 曲目标题 */}
      <h1 className="text-3xl text-ink font-bold text-center mb-2">{score.title}</h1>
      <p className="text-center text-ink-faded mb-2">
        {currentScore.key}调 · {currentScore.tempo} BPM
      </p>

      {/* 难度切换 */}
      <DifficultyTabs current={difficulty} onChange={setDifficulty} hasData={Object.keys(scores) as Difficulty[]} />

      {/* 谱面渲染 */}
      <div className="relative border border-ink/10 rounded-lg overflow-hidden shadow-lg mb-6">
        <CanvasBackground />
        <div className="relative z-10 overflow-x-auto p-4">
          <SvgScore score={score} scores={scores} difficulty={difficulty} />
        </div>
      </div>

      {/* 播放控制 */}
      <PlayerControls score={currentScore} />

      {/* 导出 */}
      <ExportPanel score={currentScore} />
    </div>
  );
}
```

- [ ] **Step 4: DifficultyTabs, PlayerControls, ExportPanel**

```typescript
// src/components/score/DifficultyTabs.tsx
import { Difficulty } from '@/engine/types';

interface DifficultyTabsProps {
  current: Difficulty;
  onChange: (d: Difficulty) => void;
  hasData: Difficulty[];
}

const LABELS: Record<Difficulty, { name: string; desc: string }> = {
  easy: { name: '入门', desc: '基础弹挑·一把位·慢速' },
  medium: { name: '进阶', desc: '多技法·三把位·中速' },
  hard: { name: '专业', desc: '全技法·全把位·原速' },
};

export default function DifficultyTabs({ current, onChange, hasData }: DifficultyTabsProps) {
  return (
    <div className="flex justify-center gap-2 mb-6">
      {(Object.keys(LABELS) as Difficulty[]).map((d) => (
        <button key={d} onClick={() => hasData.includes(d) && onChange(d)}
          disabled={!hasData.includes(d)}
          className={`px-5 py-2 rounded-lg text-sm transition-all ${
            current === d ? 'bg-vermilion text-white shadow-md' : 'bg-rice-dark text-ink-light hover:bg-rice'
          } ${!hasData.includes(d) ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <div className="font-bold">{LABELS[d].name}</div>
          <div className="text-xs opacity-70">{LABELS[d].desc}</div>
        </button>
      ))}
    </div>
  );
}
```

```typescript
// src/components/score/PlayerControls.tsx
'use client';
import { useRef, useCallback } from 'react';
import { ScoreData, PlayerState } from '@/engine/types';
import { ScorePlayer } from '@/audio/scorePlayer';
import { loadPipaSamples } from '@/audio/soundFontLoader';

interface PlayerControlsProps {
  score: ScoreData;
}

export default function PlayerControls({ score }: PlayerControlsProps) {
  const playerRef = useRef<ScorePlayer | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>('stopped');
  const [progress, setProgress] = useState(0);
  const [tempo, setTempoState] = useState(score.tempo);
  const [loaded, setLoaded] = useState(false);

  const initPlayer = useCallback(async () => {
    if (playerRef.current) return;
    await loadPipaSamples();
    const player = new ScorePlayer({
      onStateChange: setPlayerState,
      onNoteChange: () => {},
      onProgress: setProgress,
    });
    player.load(score);
    playerRef.current = player;
    setLoaded(true);
  }, [score]);

  function handlePlay() {
    if (!loaded) {
      initPlayer().then(() => playerRef.current?.play());
      return;
    }
    if (playerState === 'paused') playerRef.current?.resume();
    else playerRef.current?.play();
  }

  function handleStop() {
    playerRef.current?.stop();
  }

  function handleTempoChange(t: number) {
    setTempoState(t);
    playerRef.current?.setTempo(t);
  }

  return (
    <div className="flex items-center gap-4 justify-center py-4">
      <button onClick={handlePlay}
        className="px-6 py-3 bg-vermilion text-white rounded-full hover:bg-vermilion-dark transition-colors text-lg">
        {playerState === 'playing' ? '⏸ 暂停' : '▶ 播放'}
      </button>
      <button onClick={handleStop}
        className="px-4 py-2 border border-ink/20 rounded-lg hover:bg-rice-dark transition-colors">
        ⏹ 停止
      </button>
      <div className="flex items-center gap-2 text-sm text-ink-faded">
        <span>速度</span>
        <input type="range" min={40} max={200} value={tempo}
          onChange={(e) => handleTempoChange(Number(e.target.value))}
          className="w-24" />
        <span>{tempo} BPM</span>
      </div>
      <div className="w-32 bg-rice-dark rounded-full h-1.5 overflow-hidden">
        <div className="h-full bg-vermilion transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
```

Note: `PlayerControls.tsx` needs `useState` imported — add `import { useState, useRef, useCallback } from 'react';`.

```typescript
// src/components/score/ExportPanel.tsx
'use client';
import { ScoreData } from '@/engine/types';

interface ExportPanelProps {
  score: ScoreData;
}

export default function ExportPanel({ score }: ExportPanelProps) {
  function handleExportJSON() {
    const blob = new Blob([JSON.stringify(score, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${score.title}-${score.difficulty}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex justify-center gap-4 mt-4">
      <button onClick={handleExportJSON}
        className="px-4 py-2 border border-ink/20 rounded-lg hover:bg-rice-dark transition-colors text-sm">
        📥 导出 JSON
      </button>
      <button onClick={handlePrint}
        className="px-4 py-2 border border-ink/20 rounded-lg hover:bg-rice-dark transition-colors text-sm">
        🖨 打印曲谱
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Score Page**

```typescript
// src/app/score/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAppState } from '@/store/AppContext';
import { ScoreData, Difficulty } from '@/engine/types';
import ScoreRenderer from '@/components/score/ScoreRenderer';

export default function ScorePage() {
  const { id } = useParams<{ id: string }>();
  const { state, dispatch } = useAppState();
  const [scores, setScores] = useState<Record<Difficulty, ScoreData>>();

  useEffect(() => {
    // 从 sessionStorage 恢复三种难度数据
    const easy = sessionStorage.getItem('scores-easy');
    const medium = sessionStorage.getItem('scores-medium');
    const hard = sessionStorage.getItem('scores-hard');

    if (easy && medium && hard) {
      const data = {
        easy: JSON.parse(easy) as ScoreData,
        medium: JSON.parse(medium) as ScoreData,
        hard: JSON.parse(hard) as ScoreData,
      };
      setScores(data);

      // 保存到曲谱库
      dispatch({
        type: 'ADD_TO_LIBRARY',
        payload: {
          id: data.medium.id,
          title: data.medium.title,
          difficulty: 'medium',
          createdAt: data.medium.createdAt,
          sourceType: data.medium.sourceType,
          scoreData: data.medium,
        },
      });
    }
  }, [id, dispatch]);

  if (!scores) {
    return <div className="text-center py-20 text-ink-faded">加载中...</div>;
  }

  return <ScoreRenderer score={scores.medium} scores={scores} />;
}
```

- [ ] **Step 6: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add -A && git commit -m "feat: add SVG+Canvas score renderer, player controls, and score page"
```

---

### Task 15: 曲谱库页面 & 预置素材数据

**Files:**
- Create: `src/data/presets.ts`
- Create: `src/app/library/page.tsx`
- Create: `src/components/library/ScoreCard.tsx`

- [ ] **Step 1: 预置素材数据（20 首）**

```typescript
// src/data/presets.ts
import { PresetMaterial } from '@/engine/types';

export const presets: PresetMaterial[] = [
  // === 10 首转谱素材（预置 MIDI 音频） ===
  { id: 'transcribe-1', title: '茉莉花', category: 'transcribe',
    audioUrl: '/presets/jasmine.mid', description: '经典中国民歌', tags: ['民歌', '入门', 'D调'] },
  { id: 'transcribe-2', title: '月亮代表我的心', category: 'transcribe',
    audioUrl: '/presets/moon-heart.mid', description: '邓丽君经典', tags: ['流行', '抒情', 'C调'] },
  { id: 'transcribe-3', title: '青花瓷', category: 'transcribe',
    audioUrl: '/presets/blue-porcelain.mid', description: '周杰伦中国风', tags: ['流行', '中国风', 'D调'] },
  { id: 'transcribe-4', title: '兰亭序', category: 'transcribe',
    audioUrl: '/presets/lanting.mid', description: '周杰伦中国风', tags: ['流行', '中国风', 'D调'] },
  { id: 'transcribe-5', title: '大鱼', category: 'transcribe',
    audioUrl: '/presets/big-fish.mid', description: '《大鱼海棠》主题曲', tags: ['影视', '抒情', 'F调'] },
  { id: 'transcribe-6', title: '凉凉', category: 'transcribe',
    audioUrl: '/presets/cool.mid', description: '《三生三世》主题曲', tags: ['影视', '古风', 'E调'] },
  { id: 'transcribe-7', title: '千与千寻', category: 'transcribe',
    audioUrl: '/presets/spirited-away.mid', description: '久石让经典', tags: ['影视', '日系', 'C调'] },
  { id: 'transcribe-8', title: '梁祝', category: 'transcribe',
    audioUrl: '/presets/butterfly-lovers.mid', description: '小提琴协奏曲经典', tags: ['经典', '民乐', 'D调'] },
  { id: 'transcribe-9', title: '沧海一声笑', category: 'transcribe',
    audioUrl: '/presets/sea-laugh.mid', description: '《笑傲江湖》主题曲', tags: ['影视', '武侠', 'G调'] },
  { id: 'transcribe-10', title: '知否知否', category: 'transcribe',
    audioUrl: '/presets/know.mid', description: '《知否》主题曲', tags: ['影视', '古风', 'D调'] },

  // === 10 首琵琶经典参考（预置谱面数据，无音频） ===
  { id: 'ref-1', title: '春江花月夜', category: 'reference',
    description: '琵琶文曲代表作，描写春江月夜的优美景色', tags: ['文曲', '经典', 'G调'] },
  { id: 'ref-2', title: '十面埋伏', category: 'reference',
    description: '琵琶武曲巅峰之作，描写楚汉战争', tags: ['武曲', '经典', 'D调'] },
  { id: 'ref-3', title: '阳春白雪', category: 'reference',
    description: '琵琶古曲，清新活泼', tags: ['古曲', '经典', 'D调'] },
  { id: 'ref-4', title: '大浪淘沙', category: 'reference',
    description: '华彦钧（阿炳）传谱', tags: ['民间', '经典', 'D调'] },
  { id: 'ref-5', title: '彝族舞曲', category: 'reference',
    description: '王惠然作曲，描写彝族风情', tags: ['现代', '民族', 'D调'] },
  { id: 'ref-6', title: '渭水情', category: 'reference',
    description: '任鸿翔作曲，西北风格', tags: ['现代', '西北风', 'D调'] },
  { id: 'ref-7', title: '昭君出塞', category: 'reference',
    description: '华彦钧传谱，描写王昭君出塞故事', tags: ['民间', '叙事', 'D调'] },
  { id: 'ref-8', title: '飞花点翠', category: 'reference',
    description: '瀛洲古调，描写飞花与翠鸟', tags: ['古曲', '文曲', 'D调'] },
  { id: 'ref-9', title: '霸王卸甲', category: 'reference',
    description: '琵琶武曲，描写项羽垓下之战', tags: ['武曲', '经典', 'D调'] },
  { id: 'ref-10', title: '草原英雄小姐妹', category: 'reference',
    description: '吴祖强、王燕樵、刘德海作曲', tags: ['现代', '叙事', 'D调'] },
];
```

- [ ] **Step 2: ScoreCard + Library 页面**

```typescript
// src/components/library/ScoreCard.tsx
import { ScoreLibraryEntry } from '@/engine/types';
import Link from 'next/link';

export default function ScoreCard({ entry, onDelete }: {
  entry: ScoreLibraryEntry; onDelete: (id: string) => void;
}) {
  return (
    <div className="border border-ink/10 rounded-lg p-4 bg-rice/50 hover:shadow-md transition-shadow">
      <Link href={`/score/${entry.id}`}>
        <h3 className="text-lg font-bold text-ink hover:text-vermilion transition-colors">{entry.title}</h3>
      </Link>
      <div className="flex gap-2 mt-2 text-xs text-ink-faded">
        <span>{entry.difficulty === 'easy' ? '入门' : entry.difficulty === 'medium' ? '进阶' : '专业'}</span>
        <span>·</span>
        <span>{entry.sourceType === 'upload' ? '自上传' : '预置'}</span>
        <span>·</span>
        <span>{new Date(entry.createdAt).toLocaleDateString('zh-CN')}</span>
      </div>
      <button onClick={() => onDelete(entry.id)}
        className="mt-2 text-xs text-ink-faded hover:text-vermilion transition-colors">
        删除
      </button>
    </div>
  );
}
```

```typescript
// src/app/library/page.tsx
'use client';
import { useAppState } from '@/store/AppContext';
import ScoreCard from '@/components/library/ScoreCard';

export default function LibraryPage() {
  const { state, dispatch } = useAppState();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl text-ink font-bold mb-8 text-center">曲谱库</h1>

      {state.library.length === 0 ? (
        <div className="text-center py-20 text-ink-faded">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-lg">暂无保存的曲谱</p>
          <p className="text-sm mt-2">生成的曲谱会自动保存在这里</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.library.map((entry) => (
            <ScoreCard key={entry.id} entry={entry}
              onDelete={(id) => dispatch({ type: 'REMOVE_FROM_LIBRARY', payload: id })} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Compile check and commit**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit
git add -A && git commit -m "feat: add preset library data (20 entries) and library page with score cards"
```

---

## Phase 6: 上线前收尾

### Task 16: 错误边界 + 浏览器兼容检测 + 文档更新

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/app/layout.tsx` (wrap with ErrorBoundary)
- Update: `产品介绍.md`, `产品更新日志.md`

- [ ] **Step 1: 浏览器兼容检测 + ErrorBoundary**

```typescript
// src/components/ErrorBoundary.tsx
'use client';
import React from 'react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: string | null; }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto py-20 text-center">
          <div className="text-6xl mb-6">💔</div>
          <h2 className="text-xl text-ink font-bold mb-4">出现错误</h2>
          <p className="text-ink-light mb-6">{this.state.error}</p>
          <button onClick={() => window.location.reload()}
            className="px-6 py-2 bg-vermilion text-white rounded-lg hover:bg-vermilion-dark transition-colors">
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: 更新布局引入 ErrorBoundary**

在 `src/app/layout.tsx` 中，将 children 包裹在 `<ErrorBoundary>` 内。

- [ ] **Step 3: 更新三文档**

更新 `产品介绍.md`（部署地址、当前版本状态）、`产品更新日志.md`（追加 v1.0 开发完成记录）。

- [ ] **Step 4: 最终 compile check**

```bash
cd /Users/lulu/pipa-score-generator && npx tsc --noEmit && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add error boundary, browser check, and update documentation for v1.0 MVP"
```

---

## Verification

1. `npm run dev` → 访问 http://localhost:3000，确认首页古风水墨动画正常显示
2. 上传一首 mp3 文件（15-30 秒），验证处理流程四个步骤正常推进
3. 谱面页面检查三难度切换标签、SVG 谱面渲染、音符数字和技法符号显示正确
4. 点击播放按钮，确认有声音输出且进度条更新
5. 导出 JSON 文件，检查数据结构完整
6. 刷新页面后访问 `/library`，确认曲谱已自动保存
7. `npm run build` 成功（无 TypeScript 错误）
