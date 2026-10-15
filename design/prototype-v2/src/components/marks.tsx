import { Box, Laptop, Server, Cloud } from 'lucide-react'
import { Logo } from './logos'
import { kindMeta, type Machine } from '@/lib/data'
import { cn } from '@/lib/cn'

/** Jcode mark: a bracket that doubles as a run thread with a live node. */
export function JMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="jm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brass)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--brass) 55%, #000)" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="23" height="23" rx="7" fill="url(#jm)" />
      <path d="M14.5 6v8.2a3.3 3.3 0 0 1-3.3 3.3H9.6" fill="none" stroke="var(--brass-ink)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="14.5" cy="6" r="1.9" fill="var(--brass-ink)" />
    </svg>
  )
}

/** Small square that says where something runs: hue = kind, glyph = provider. */
export function MachineMark({ m, size = 26, className }: { m: Machine; size?: number; className?: string }) {
  const icon =
    m.provider && m.kind !== 'local' ? <Logo name={m.provider} size={size * 0.5} tinted /> :
    m.kind === 'local' ? <Laptop size={size * 0.5} /> :
    m.kind === 'sandbox' ? <Box size={size * 0.5} /> :
    m.kind === 'vm' ? <Cloud size={size * 0.5} /> : <Server size={size * 0.5} />
  return (
    <span
      className={cn('relative grid shrink-0 place-items-center rounded-[8px] border border-seam-2 bg-slab-2', kindMeta[m.kind].color, className)}
      style={{ width: size, height: size }}
    >
      {icon}
      <span
        className={cn('absolute -bottom-[2px] -right-[2px] size-[8px] rounded-full border-[2px] border-soot',
          m.status === 'online' ? 'bg-sage' : m.status === 'sleeping' ? 'bg-ember' : m.status === 'on-demand' ? 'bg-lilac' : 'bg-ash')}
      />
    </span>
  )
}
