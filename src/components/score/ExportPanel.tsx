'use client';
import { ScoreData } from '@/engine/types';

interface ExportPanelProps { score: ScoreData; }

export default function ExportPanel({ score }: ExportPanelProps) {
  function handleExportJSON() {
    const blob = new Blob([JSON.stringify(score, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${score.title}-${score.difficulty}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  function handlePrint() { window.print(); }

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
