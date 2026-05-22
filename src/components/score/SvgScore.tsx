'use client';
import { ScoreData, Difficulty, PipaNote, Measure } from '@/engine/types';

interface SvgScoreProps {
  score: ScoreData;
  scores: Record<Difficulty, ScoreData>;
  difficulty: Difficulty;
}

const NOTE_WIDTH = 50;
const NOTE_HEIGHT = 80;
const ROW_PADDING = 40;
const MARGIN = 40;
const MAX_ROW_WIDTH = 900;
const NOTE_NAME_MAP = ['1', '1', '2', '2', '3', '4', '4', '5', '5', '6', '6', '7'];

interface LayoutNote extends PipaNote {
  measureIndex: number;
}

export default function SvgScore({ score, scores, difficulty }: SvgScoreProps) {
  const scoreData = scores[difficulty];
  if (!scoreData) return <p className="text-center py-10 text-ink-faded">暂无该难度谱面</p>;

  const measures = scoreData.measures;
  if (measures.length === 0) {
    return <p className="text-center py-10 text-ink-faded">该难度暂无音符</p>;
  }

  // 将所有音符展开为扁平列表
  const allNotes: LayoutNote[] = [];
  for (const measure of measures) {
    for (const note of measure.notes) {
      allNotes.push({ ...note, measureIndex: measure.index });
    }
  }

  // 分行：每行放尽可能多的音符，小节边界处可以提前换行
  const rows: LayoutNote[][] = [];
  let currentRow: LayoutNote[] = [];
  let currentRowWidth = 0;

  for (let i = 0; i < allNotes.length; i++) {
    const note = allNotes[i];
    const noteW = NOTE_WIDTH;
    // 遇到新小节且当前行已有足够多内容时换行
    if (i > 0 && note.measureIndex !== allNotes[i - 1].measureIndex && currentRowWidth > MAX_ROW_WIDTH * 0.4) {
      rows.push(currentRow);
      currentRow = [];
      currentRowWidth = 0;
    }
    // 行满则换行
    if (currentRowWidth + noteW > MAX_ROW_WIDTH && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
      currentRowWidth = 0;
    }
    currentRow.push(note);
    currentRowWidth += noteW;
  }
  if (currentRow.length > 0) rows.push(currentRow);

  const svgWidth = MAX_ROW_WIDTH + MARGIN * 2;
  const svgHeight = rows.length * (NOTE_HEIGHT + ROW_PADDING) + MARGIN;

  return (
    <svg width={svgWidth} height={svgHeight} className="w-full h-auto">
      {rows.map((row, rowIdx) => {
        const y = rowIdx * (NOTE_HEIGHT + ROW_PADDING) + ROW_PADDING;
        let lastMeasureIdx = -1;
        return (
          <g key={rowIdx}>
            {row.map((note, nIdx) => {
              const x = MARGIN + nIdx * NOTE_WIDTH;
              const ny = y;
              const showMeasureLine = note.measureIndex !== lastMeasureIdx;
              lastMeasureIdx = note.measureIndex;
              const pitchClass = note.pitch % 12;
              const noteName = NOTE_NAME_MAP[pitchClass] || '1';

              return (
                <g key={`${note.measureIndex}-${nIdx}`}>
                  {/* 小节线 */}
                  {showMeasureLine && (
                    <line x1={x - 2} y1={ny} x2={x - 2} y2={ny + NOTE_HEIGHT} stroke="#2c1810" strokeWidth={1.5} opacity={0.6} />
                  )}
                  {/* 音符数字 */}
                  <text x={x + NOTE_WIDTH / 2} y={ny + 30} fill="#2c1810" fontSize="18" fontWeight="bold" textAnchor="middle">
                    {noteName}
                  </text>
                  {/* 减时线 */}
                  {note.duration <= 0.5 && (
                    <line x1={x + NOTE_WIDTH / 2 - 10} y1={ny + 36} x2={x + NOTE_WIDTH / 2 + 10} y2={ny + 36} stroke="#2c1810" strokeWidth={1.5} />
                  )}
                  {note.duration <= 0.25 && (
                    <line x1={x + NOTE_WIDTH / 2 - 10} y1={ny + 40} x2={x + NOTE_WIDTH / 2 + 10} y2={ny + 40} stroke="#2c1810" strokeWidth={1.5} />
                  )}
                  {/* 技法标记 */}
                  {note.technique && (
                    <text x={x + NOTE_WIDTH / 2} y={ny - 2} fill="#c41e3a" fontSize="12" textAnchor="middle">
                      {note.technique.symbol}
                    </text>
                  )}
                  {/* 弦位标注 */}
                  <text x={x + NOTE_WIDTH / 2} y={ny + 52} fill="#8b7355" fontSize="8" textAnchor="middle">
                    {note.stringNumber > 0 ? `${['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'][note.stringNumber]}${note.fretPosition}` : ''}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
