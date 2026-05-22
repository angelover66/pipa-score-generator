'use client';
import { useState, useRef, useCallback } from 'react';
import { ScoreData, PlayerState } from '@/engine/types';
import { ScorePlayer } from '@/audio/scorePlayer';
import { loadPipaSamples } from '@/audio/soundFontLoader';

interface PlayerControlsProps { score: ScoreData; }

export default function PlayerControls({ score }: PlayerControlsProps) {
  const playerRef = useRef<ScorePlayer | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>('stopped');
  const [progress, setProgress] = useState(0);
  const [tempo, setTempoState] = useState(score.tempo);
  const [loaded, setLoaded] = useState(false);

  const initPlayer = useCallback(async () => {
    if (playerRef.current) return;
    await loadPipaSamples();
    const player = new ScorePlayer({
      onStateChange: setPlayerState,
      onNoteChange: () => {},
      onProgress: setProgress,
    });
    player.load(score);
    playerRef.current = player;
    setLoaded(true);
  }, [score]);

  function handlePlay() {
    if (!loaded) { initPlayer().then(() => playerRef.current?.play()); return; }
    if (playerState === 'paused') playerRef.current?.resume();
    else playerRef.current?.play();
  }

  function handleStop() { playerRef.current?.stop(); }

  function handleTempoChange(t: number) {
    setTempoState(t);
    playerRef.current?.setTempo(t);
  }

  return (
    <div className="flex items-center gap-4 justify-center py-4">
      <button onClick={handlePlay}
        className="px-6 py-3 bg-vermilion text-white rounded-full hover:bg-vermilion-dark transition-colors text-lg">
        {playerState === 'playing' ? '⏸ 暂停' : '▶ 播放'}
      </button>
      <button onClick={handleStop}
        className="px-4 py-2 border border-ink/20 rounded-lg hover:bg-rice-dark transition-colors">
        ⏹ 停止
      </button>
      <div className="flex items-center gap-2 text-sm text-ink-faded">
        <span>速度</span>
        <input type="range" min={40} max={200} value={tempo}
          onChange={(e) => handleTempoChange(Number(e.target.value))} className="w-24" />
        <span>{tempo} BPM</span>
      </div>
      <div className="w-32 bg-rice-dark rounded-full h-1.5 overflow-hidden">
        <div className="h-full bg-vermilion transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
