'use client';
import { useState, useRef } from 'react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export default function UploadZone({ onFileSelect, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && !disabled) onFileSelect(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && !disabled) onFileSelect(file);
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-all duration-300 cursor-pointer
        ${isDragging ? 'border-vermilion bg-vermilion/5 scale-[1.02]' : 'border-ink/20 hover:border-ink/40 bg-rice/50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" className="hidden"
        accept="audio/*,video/*,.mp3,.wav,.flac,.m4a,.aac,.mp4,.mov,.mkv"
        onChange={handleChange} disabled={disabled} />
      <div className="text-6xl mb-4 animate-float">🎵</div>
      <p className="text-xl text-ink mb-2">拖拽上传音频或视频文件</p>
      <p className="text-sm text-ink-faded">支持 mp3 / wav / flac / m4a / aac / mp4 / mov / mkv</p>
      <p className="text-xs text-ink-faded mt-1">最大 100MB · 15秒~10分钟</p>
    </div>
  );
}
