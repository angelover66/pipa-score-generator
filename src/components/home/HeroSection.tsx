'use client';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/store/AppContext';
import { validateFile } from '@/audio/ffmpegExtractor';
import InkAnimation from './InkAnimation';
import UploadZone from './UploadZone';
import PresetQuickSelect from './PresetQuickSelect';
import { PresetMaterial } from '@/engine/types';

export default function HeroSection() {
  const router = useRouter();
  const { state, dispatch } = useAppState();

  function handleFile(file: File) {
    const result = validateFile(file);
    if (!result.valid) {
      dispatch({ type: 'SET_ERROR', payload: result.error ?? null });
      return;
    }
    sessionStorage.setItem('pending-file-name', file.name);
    const url = URL.createObjectURL(file);
    sessionStorage.setItem('pending-file-url', url);
    router.push('/generate');
  }

  function handlePreset(preset: PresetMaterial) {
    sessionStorage.setItem('pending-preset-id', preset.id);
    router.push('/generate');
  }

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      <InkAnimation />
      <div className="relative z-10 max-w-2xl mx-auto px-6 py-20 text-center animate-ink-drip">
        <h1 className="text-5xl md:text-6xl text-ink font-bold mb-6 tracking-widest">
          琵琶简谱生成器
        </h1>
        <p className="text-lg text-ink-light mb-10 leading-relaxed">
          上传任意音乐，AI 自动生成三种难度琵琶简谱<br />
          可模拟琵琶弹奏播放，让练习不再枯燥
        </p>
        <UploadZone onFileSelect={handleFile} />
        <PresetQuickSelect presets={state.presets} onSelect={handlePreset} />
      </div>
    </section>
  );
}
