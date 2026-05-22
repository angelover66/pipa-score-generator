import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-rice-dark/80 backdrop-blur border-b border-ink/10">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="text-2xl text-ink font-bold tracking-wider hover:text-vermilion transition-colors">
          琵琶谱
        </Link>
        <div className="flex gap-6 text-ink-light">
          <Link href="/library" className="hover:text-vermilion transition-colors">曲谱库</Link>
        </div>
      </div>
    </nav>
  );
}
