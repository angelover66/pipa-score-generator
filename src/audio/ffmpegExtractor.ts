import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export async function initFFmpeg(onProgress?: (percent: number) => void): Promise<void> {
  if (ffmpeg && ffmpeg.loaded) return;
  ffmpeg = new FFmpeg();
  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(Math.round(progress * 50));
  });
  await ffmpeg.load();
}

export async function extractAudio(file: File): Promise<Float32Array> {
  if (!ffmpeg) throw new Error('FFMPEG_LOAD_FAIL: ffmpeg not initialized');
  const inputName = 'input' + file.name.slice(file.name.lastIndexOf('.'));
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec(['-i', inputName, '-ar', '16000', '-ac', '1', '-f', 'f32le', 'output.f32le']);
  const data = await ffmpeg.readFile('output.f32le');
  return new Float32Array((data as Uint8Array).buffer);
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  const validAudio = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/aac', 'audio/x-m4a'];
  const validVideo = ['video/mp4', 'video/quicktime', 'video/x-matroska'];
  const allValid = [...validAudio, ...validVideo];
  if (!allValid.includes(file.type) && !file.name.match(/\.(mp3|wav|flac|m4a|aac|mp4|mov|mkv)$/i)) {
    return { valid: false, error: '请上传支持的音频或视频文件（mp3/wav/flac/m4a/aac/mp4/mov/mkv）' };
  }
  if (file.size > 100 * 1024 * 1024) {
    return { valid: false, error: '文件过大，请上传 100MB 以内的文件' };
  }
  return { valid: true };
}
