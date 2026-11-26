import Image from 'next/image';

export default function Avatar({ name, src, size = 32 }: { name: string; src: string | null; size?: number }) {
  if (src && src.startsWith('http')) {
    return <Image src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" unoptimized />;
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return (
    <span style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-track/10 font-display font-semibold text-track">
      {initials}
    </span>
  );
}
