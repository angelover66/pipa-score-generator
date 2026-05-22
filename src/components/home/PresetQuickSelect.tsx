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
