'use client';
import { ScoreData, Difficulty } from '@/engine/types';

interface SvgScoreProps {
  score: ScoreData;
  scores: Record<Difficulty, ScoreData>;
  difficulty: Difficulty;
}

export default function SvgScore({ score, scores, difficulty }: SvgScoreProps) {
  const scoreData = scores[difficulty];
  if (!scoreData) return <p className="text-center py-10 text-ink-faded">暂无该难度谱面</p>;

  const NOTE_WIDTH = 40;
  const NOTE_HEIGHT = 80;
  const MEASURE_GAP = 20;
  const NOTES_PER_ROW = 16;
  const measures = scoreData.measures;

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
                <line x1={0} y1={0} x2={0} y2={NOTE_HEIGHT} stroke="#2c1810" strokeWidth={1} />
                {measure.notes.map((note, nIdx) => {
                  const nx = nIdx * NOTE_WIDTH + 10;
                  const ny = 20;
                  const pitchClass = note.pitch % 12;
                  const noteNameMap = ['1', '1', '2', '2', '3', '4', '4', '5', '5', '6', '6', '7'];
                  const noteName = noteNameMap[pitchClass] || '1';

                  return (
                    <g key={nIdx}>
                      <text x={nx} y={ny + 30} fill="#2c1810" fontSize="18" fontWeight="bold" textAnchor="middle">
                        {noteName}
                      </text>
                      {note.duration <= 0.5 && (
                        <line x1={nx - 8} y1={ny + 36} x2={nx + 8} y2={ny + 36} stroke="#2c1810" strokeWidth={1.5} />
                      )}
                      {note.duration <= 0.25 && (
                        <line x1={nx - 8} y1={ny + 40} x2={nx + 8} y2={ny + 40} stroke="#2c1810" strokeWidth={1.5} />
                      )}
                      {note.technique && (
                        <text x={nx} y={ny - 2} fill="#c41e3a" fontSize="12" textAnchor="middle">
                          {note.technique.symbol}
                        </text>
                      )}
                      <text x={nx} y={ny + 52} fill="#8b7355" fontSize="8" textAnchor="middle">
                        {note.stringNumber > 0 ? `${note.stringNumber === 1 ? 'Ⅰ' : note.stringNumber === 2 ? 'Ⅱ' : note.stringNumber === 3 ? 'Ⅲ' : 'Ⅳ'}${note.fretPosition}` : ''}
                      </text>
                    </g>
                  );
                })}
                <line x1={NOTES_PER_ROW * NOTE_WIDTH / 4} y1={0} x2={NOTES_PER_ROW * NOTE_WIDTH / 4} y2={NOTE_HEIGHT} stroke="#2c1810" strokeWidth={1} />
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}
