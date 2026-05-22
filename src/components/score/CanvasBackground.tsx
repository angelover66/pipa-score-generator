'use client';
import { useEffect, useRef } from 'react';

export default function CanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    ctx.fillStyle = '#faf7f0';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 500; i++) {
      const x = Math.random() * w / 2;
      const y = Math.random() * h / 2;
      ctx.strokeStyle = `rgba(139, 115, 85, ${Math.random() * 0.06})`;
      ctx.lineWidth = Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.random() * 60 - 30, y + Math.random() * 2 - 1);
      ctx.stroke();
    }

    const corners = [[40, 40], [w / 2 - 100, 40], [40, h / 2 - 100]];
    for (const [cx, cy] of corners) {
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80);
      gradient.addColorStop(0, 'rgba(139, 115, 85, 0.06)');
      gradient.addColorStop(1, 'rgba(139, 115, 85, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - 80, cy - 80, 160, 160);
    }
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded-lg" />;
}
