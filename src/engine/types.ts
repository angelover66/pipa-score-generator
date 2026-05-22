// src/engine/types.ts

// === Basic Pitch raw output ===
export interface RawNote {
  pitch: number;        // MIDI note number (0-127)
  startTime: number;    // seconds
  endTime: number;      // seconds
  velocity: number;     // 0-1
}

// === Technique ===
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

// === Pipa note ===
export interface PipaNote {
  pitch: number;
  stringNumber: 1 | 2 | 3 | 4;
  fretPosition: number;
  duration: number;        // beats
  technique: Technique | null;
  isStrongBeat: boolean;
}

// === Measure ===
export interface Measure {
  index: number;
  timeSignature: [number, number]; // [4, 4]
  notes: PipaNote[];
}

// === Difficulty ===
export type Difficulty = 'easy' | 'medium' | 'hard';

// === Score data ===
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

// === Library entry ===
export interface ScoreLibraryEntry {
  id: string;
  title: string;
  difficulty: Difficulty;
  createdAt: string;
  sourceType: 'upload' | 'preset';
  scoreData: ScoreData;
}

// === Preset material ===
export interface PresetMaterial {
  id: string;
  title: string;
  category: 'transcribe' | 'reference';
  audioUrl?: string;
  scoreData?: ScoreData;
  description: string;
  tags: string[];
}

// === App state ===
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

// === Error codes ===
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
