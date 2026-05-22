'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/store/AppContext';
import { initFFmpeg, extractAudio } from '@/audio/ffmpegExtractor';
import { initBasicPitch, transcribe, validateHasMelody } from '@/audio/basicPitchTranscriber';
import { generateAllDifficulties } from '@/engine/arrangement';
import { Difficulty, ScoreData } from '@/engine/types';
import ProgressIndicator from '@/components/generate/ProgressIndicator';
import { retrieveFile, removeFile } from '@/utils/fileStorage';
import { presets } from '@/data/presets';

export default function GeneratePage() {
  const router = useRouter();
  const { dispatch } = useAppState();
  const [processingStep, setProcessingStep] = useState<'extracting' | 'transcribing' | 'arranging' | 'rendering'>('extracting');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const process = useCallback(async () => {
    try {
      dispatch({ type: 'SET_STEP', payload: 'processing' });

      setProcessingStep('extracting');
      setPercent(0);
      await initFFmpeg((p) => setPercent(p));
      setPercent(100);

      const presetId = sessionStorage.getItem('pending-preset-id');
      let audioData: Float32Array;
      let title: string;
      let sourceType: 'upload' | 'preset';

      if (presetId) {
        const preset = presets.find((p) => p.id === presetId);
        if (!preset || !preset.audioUrl) throw new Error('预置素材加载失败');
        title = preset.title;
        sourceType = 'preset';
        const resp = await fetch(preset.audioUrl);
        const buffer = await resp.arrayBuffer();
        audioData = new Float32Array(buffer);
      } else {
        const fileName = sessionStorage.getItem('pending-file-name') || '未命名曲目';
        const stored = await retrieveFile('pending-upload');
        if (!stored) throw new Error('未找到上传文件，请重新上传');
        title = fileName.replace(/\.[^.]+$/, '');
        sourceType = 'upload';
        const file = new File([stored.buffer], stored.name || fileName, { type: stored.type });
        await removeFile('pending-upload');
        audioData = await extractAudio(file);
      }

      setProcessingStep('transcribing');
      setPercent(0);
      await initBasicPitch((p) => setPercent(p));
      const rawNotes = await transcribe(audioData, (p) => setPercent(p));

      if (!validateHasMelody(rawNotes)) {
        throw new Error('BASIC_PITCH_EMPTY: 未检测到可用旋律，请尝试其他音频');
      }
      setPercent(100);

      setProcessingStep('arranging');
      setPercent(50);
      const scores = generateAllDifficulties(rawNotes, title, sourceType);
      setPercent(100);

      setProcessingStep('rendering');
      setPercent(100);

      dispatch({ type: 'SET_SCORE', payload: scores.medium });
      sessionStorage.setItem('scores-easy', JSON.stringify(scores.easy));
      sessionStorage.setItem('scores-medium', JSON.stringify(scores.medium));
      sessionStorage.setItem('scores-hard', JSON.stringify(scores.hard));

      router.push(`/score/${scores.medium.id}`);
    } catch (err: any) {
      const msg = err?.message || '处理失败';
      setError(msg);
      dispatch({ type: 'SET_ERROR', payload: msg });
    }
  }, [dispatch, router]);

  useEffect(() => { process(); }, [process]);

  if (error) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="text-6xl mb-6">😞</div>
        <h2 className="text-xl text-ink font-bold mb-4">处理失败</h2>
        <p className="text-ink-light mb-6">{error}</p>
        <button onClick={() => router.push('/')} className="px-6 py-2 bg-vermilion text-white rounded-lg hover:bg-vermilion-dark transition-colors">
          重新开始
        </button>
      </div>
    );
  }

  return <ProgressIndicator step={processingStep} percent={percent} />;
}
