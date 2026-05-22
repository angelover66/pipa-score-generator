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
