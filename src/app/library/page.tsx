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
