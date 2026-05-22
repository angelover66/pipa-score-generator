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
