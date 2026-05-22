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
