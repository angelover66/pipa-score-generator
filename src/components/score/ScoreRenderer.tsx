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
      <h1 className="text-3xl text-ink font-bold text-center mb-2">{score.title}</h1>
      <p className="text-center text-ink-faded mb-2">{currentScore.key}调 · {currentScore.tempo} BPM</p>
      <DifficultyTabs current={difficulty} onChange={setDifficulty} hasData={Object.keys(scores) as Difficulty[]} />
      <div className="relative border border-ink/10 rounded-lg overflow-hidden shadow-lg mb-6">
        <CanvasBackground />
        <div className="relative z-10 overflow-x-auto p-4">
          <SvgScore score={score} scores={scores} difficulty={difficulty} />
        </div>
      </div>
      <PlayerControls score={currentScore} />
      <ExportPanel score={currentScore} />
    </div>
  );
}
