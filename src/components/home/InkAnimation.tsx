'use client';
import { useEffect, useRef } from 'react';

export default function InkAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    let particles: Array<{ x: number; y: number; r: number; alpha: number; vy: number }> = [];

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < 0.1) {
        particles.push({
          x: Math.random() * canvas.width / 2,
          y: -10,
          r: Math.random() * 30 + 10,
          alpha: Math.random() * 0.08 + 0.02,
          vy: Math.random() * 0.3 + 0.1,
        });
      }
      particles = particles.filter((p) => p.y < canvas.height / 2 + 50);
      for (const p of particles) {
        p.y += p.vy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(44, 24, 16, ${p.alpha})`;
        ctx.fill();
      }
      requestAnimationFrame(animate);
    }
    animate();
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" />;
}
