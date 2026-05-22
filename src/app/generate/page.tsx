'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/store/AppContext';
import { initFFmpeg, extractAudio } from '@/audio/ffmpegExtractor';
import { initBasicPitch, transcribe, validateHasMelody } from '@/audio/basicPitchTranscriber';
import { generateAllDifficulties } from '@/engine/arrangement';
import { Difficulty, ScoreData, ProcessingStep } from '@/engine/types';
import ProgressIndicator from '@/components/generate/ProgressIndicator';
import { retrieveFile, removeFile } from '@/utils/fileStorage';
import { presets } from '@/data/presets';

export default function GeneratePage() {
  const router = useRouter();
  const { dispatch } = useAppState();
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('extracting');
  const stepRef = useRef<ProcessingStep>('extracting');
  const updateStep = (step: ProcessingStep) => {
    stepRef.current = step;
    setProcessingStep(step);
  };
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<ProcessingStep | null>(null);

  const process = useCallback(async () => {
    try {
      dispatch({ type: 'SET_STEP', payload: 'processing' });

      updateStep('extracting');
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

      updateStep('transcribing');
      setPercent(0);
      await initBasicPitch((p) => setPercent(p));
      const rawNotes = await transcribe(audioData, (p) => setPercent(p));

      if (!validateHasMelody(rawNotes)) {
        throw new Error('BASIC_PITCH_EMPTY: 未检测到可用旋律，请尝试其他音频');
      }
      setPercent(100);

      updateStep('arranging');
      setPercent(50);
      const scores = generateAllDifficulties(rawNotes, title, sourceType);
      setPercent(100);

      updateStep('rendering');
      setPercent(100);

      dispatch({ type: 'SET_SCORE', payload: scores.medium });
      sessionStorage.setItem('scores-easy', JSON.stringify(scores.easy));
      sessionStorage.setItem('scores-medium', JSON.stringify(scores.medium));
      sessionStorage.setItem('scores-hard', JSON.stringify(scores.hard));

      router.push(`/score/${scores.medium.id}`);
    } catch (err: any) {
      console.error('[GeneratePage] 处理失败', {
        step: stepRef.current,
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
        raw: err,
      });
      const detail = err?.message || String(err) || '处理失败';
      setErrorStep(stepRef.current);
      setError(detail);
      dispatch({ type: 'SET_ERROR', payload: detail });
    }
  }, [dispatch, router]);

  useEffect(() => { process(); }, [process]);

  const stepLabels: Record<ProcessingStep, string> = {
    extracting: '音频提取',
    transcribing: '旋律识别',
    arranging: '简谱生成',
    rendering: '谱面渲染',
  };

  if (error) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="text-6xl mb-6">😞</div>
        <h2 className="text-xl text-ink font-bold mb-2">处理失败</h2>
        {errorStep && (
          <p className="text-sm text-vermilion mb-1">失败阶段：{stepLabels[errorStep]}</p>
        )}
        <p className="text-ink-light mb-4">{error}</p>
        <p className="text-xs text-ink-faded mb-6 bg-rice-dark rounded-lg p-3 text-left leading-relaxed">
          提示：按 <code className="bg-ink/10 px-1 rounded">F12</code> 打开开发者工具，
          切换到 <code className="bg-ink/10 px-1 rounded">Console</code> 面板，
          可以看到完整错误堆栈。
        </p>
        <button onClick={() => router.push('/')} className="px-6 py-2 bg-vermilion text-white rounded-lg hover:bg-vermilion-dark transition-colors">
          重新开始
        </button>
      </div>
    );
  }

  return <ProgressIndicator step={processingStep} percent={percent} />;
}
