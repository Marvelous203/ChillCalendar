'use client';

const PASTEL_PALETTE = [
  ['#D8F3F2', '#0B5E5E'],
  ['#FFE6DB', '#8A3818'],
  ['#E3EBFF', '#27438B'],
  ['#F3E8FF', '#5B2A86'],
  ['#DCFCE7', '#166534'],
  ['#FEF3C7', '#854D0E'],
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  name,
  size = 'md',
  muted = false,
  className = '',
}: {
  name: string;
  size?: 'xs' | 'sm' | 'md';
  muted?: boolean;
  className?: string;
}) {
  const [bg, fg] = PASTEL_PALETTE[hashName(name) % PASTEL_PALETTE.length];
  const sizeClass =
    size === 'xs'
      ? 'h-5 w-5 text-[9px]'
      : size === 'sm'
        ? 'h-7 w-7 text-[11px]'
        : 'h-8 w-8 text-xs';

  return (
    <span
      title={name}
      style={{ backgroundColor: bg, color: fg }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold select-none ${sizeClass} ${
        muted ? 'opacity-45 grayscale' : ''
      } ${className}`}
    >
      {getInitials(name)}
    </span>
  );
}
