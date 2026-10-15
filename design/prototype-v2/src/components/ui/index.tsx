import * as React from 'react'
import { Popover as P, Tooltip as T, Dialog as D, Switch as S, Tabs as Tb, DropdownMenu as DM } from 'radix-ui'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/cn'

/* ---------------------------------- Button --------------------------------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger'
type BtnSize = 'xs' | 'sm' | 'md'
const btnBase =
  'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] font-medium select-none transition-[background,border-color,color,box-shadow,transform] duration-150 ease-out-soft active:translate-y-px disabled:opacity-40 disabled:pointer-events-none'
const btnVariants: Record<BtnVariant, string> = {
  primary:
    'bg-brass text-brass-ink shadow-[inset_0_1px_0_rgb(255_255_255/.25),0_1px_2px_rgb(0_0_0/.35),0_0_0_1px_rgb(0_0_0/.15)] hover:brightness-[1.06]',
  secondary:
    'bg-slab-2 text-bone border border-seam-2 shadow-[inset_0_1px_0_rgb(255_255_255/.04)] hover:bg-lift hover:border-seam-2',
  ghost: 'text-dust hover:text-bone hover:bg-slab-2',
  quiet: 'text-ash hover:text-bone',
  danger: 'text-rose hover:bg-rose/10',
}
const btnSizes: Record<BtnSize, string> = {
  xs: 'h-6 px-2 text-meta rounded-[7px]',
  sm: 'h-7 px-2.5 text-sec',
  md: 'h-8 px-3 text-ui',
}
export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }
>(({ className, variant = 'secondary', size = 'md', ...p }, ref) => (
  <button ref={ref} className={cn(btnBase, btnVariants[variant], btnSizes[size], className)} {...p} />
))

export const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; size?: 'sm' | 'md' }
>(({ className, active, size = 'md', ...p }, ref) => (
  <button
    ref={ref}
    className={cn(
      'relative grid place-items-center rounded-[8px] text-dust transition-colors duration-150 hover:bg-slab-2 hover:text-bone active:translate-y-px',
      size === 'md' ? 'size-8' : 'size-7',
      active && 'bg-brass/12 text-brass hover:bg-brass/16 hover:text-brass',
      className,
    )}
    {...p}
  />
))

/* ----------------------------------- Kbd ----------------------------------- */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-seam-2 border-b-[1.5px] bg-slab-2 px-1 font-sans text-[10.5px] font-medium text-dust',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
export function Keys({ k }: { k: string }) {
  return (
    <span className="inline-flex gap-0.5">
      {k.split(' ').map((x) => (
        <Kbd key={x}>{x}</Kbd>
      ))}
    </span>
  )
}

/* --------------------------------- Tooltip --------------------------------- */
export function Tip({ label, keys, children, side = 'bottom' }: { label: string; keys?: string; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <T.Root delayDuration={350}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-[100] flex items-center gap-2 rounded-[7px] border border-seam-2 bg-lift px-2 py-1 text-meta text-bone shadow-[0_8px_24px_rgb(0_0_0/.4)] data-[state=delayed-open]:animate-[tipIn_.14s_ease-out]"
        >
          {label}
          {keys && <Keys k={keys} />}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}

/* --------------------------------- Popover --------------------------------- */
export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export const PopoverAnchor = P.Anchor
export function PopoverContent({ className, children, side = 'bottom', align = 'start', sideOffset = 8, ...p }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'pop z-[90] rounded-[14px] border border-seam-2 bg-soot/95 p-1.5 text-bone shadow-[0_24px_60px_-12px_rgb(0_0_0/.6),0_0_0_1px_rgb(0_0_0/.25)] backdrop-blur-xl outline-none',
          className,
        )}
        {...p}
      >
        {children}
      </P.Content>
    </P.Portal>
  )
}

/* ------------------------------ Dropdown menu ------------------------------ */
export const Menu = DM.Root
export const MenuTrigger = DM.Trigger
export function MenuContent({ className, children, ...p }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          'pop z-[90] min-w-[200px] rounded-[12px] border border-seam-2 bg-soot/95 p-1 text-bone shadow-[0_24px_60px_-12px_rgb(0_0_0/.6)] backdrop-blur-xl outline-none',
          className,
        )}
        {...p}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  )
}
export function MenuItem({ className, ...p }: React.ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn(
        'flex h-8 cursor-default items-center gap-2.5 rounded-[8px] px-2 text-ui text-dust outline-none data-[highlighted]:bg-slab-2 data-[highlighted]:text-bone',
        className,
      )}
      {...p}
    />
  )
}
export const MenuSep = () => <DM.Separator className="mx-1 my-1 h-px bg-seam" />

/* ---------------------------------- Row ------------------------------------ */
/** Generic list row used inside popovers, palette, menus. */
export function Row({
  icon, title, hint, right, active, onClick, className, tone,
}: {
  icon?: React.ReactNode; title: React.ReactNode; hint?: React.ReactNode; right?: React.ReactNode; active?: boolean
  onClick?: () => void; className?: string; tone?: 'default' | 'muted'
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left outline-none transition-colors duration-100 hover:bg-slab-2 focus-visible:bg-slab-2',
        active && 'bg-slab-2',
        className,
      )}
    >
      {icon && <span className="grid size-7 shrink-0 place-items-center rounded-[8px] text-dust group-hover:text-bone">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-ui', tone === 'muted' ? 'text-dust' : 'text-bone')}>{title}</span>
        {hint && <span className="block truncate text-meta text-ash">{hint}</span>}
      </span>
      {right}
    </button>
  )
}

/* --------------------------------- Switch ---------------------------------- */
export function Switch({ checked, onCheckedChange, defaultChecked }: { checked?: boolean; onCheckedChange?: (v: boolean) => void; defaultChecked?: boolean }) {
  return (
    <S.Root
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      className="group relative h-[20px] w-[34px] shrink-0 rounded-full border border-seam-2 bg-slab-2 transition-colors duration-200 data-[state=checked]:border-brass/60 data-[state=checked]:bg-brass"
    >
      <S.Thumb className="block size-[14px] translate-x-[2px] rounded-full bg-dust shadow-[0_1px_2px_rgb(0_0_0/.4)] transition-[transform,background] duration-200 ease-out-soft data-[state=checked]:translate-x-[16px] data-[state=checked]:bg-brass-ink" />
    </S.Root>
  )
}

/* ---------------------------------- Tabs ----------------------------------- */
/** Segmented tabs with a sliding indicator (shared layout). */
export function Segmented<T extends string>({
  value, onChange, items, layoutId, size = 'md', className,
}: {
  value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode; icon?: React.ReactNode }[]
  layoutId: string; size?: 'sm' | 'md'; className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-[10px] border border-seam bg-soot p-[3px]', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            'relative inline-flex items-center gap-1.5 rounded-[7px] px-2.5 font-medium transition-colors duration-150',
            size === 'md' ? 'h-[26px] text-sec' : 'h-[22px] text-meta',
            value === it.value ? 'text-bone' : 'text-ash hover:text-dust',
          )}
        >
          {value === it.value && (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 rounded-[7px] border border-seam-2 bg-slab-2 shadow-[0_1px_2px_rgb(0_0_0/.3)]"
              transition={{ type: 'spring', stiffness: 520, damping: 38 }}
            />
          )}
          <span className="relative inline-flex items-center gap-1.5">{it.icon}{it.label}</span>
        </button>
      ))}
    </div>
  )
}
export const TabsRoot = Tb.Root
export const TabsContent = Tb.Content

/* --------------------------------- Dialog ---------------------------------- */
export function Dialog({
  open, onOpenChange, children, className, title,
}: { open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode; className?: string; title: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-[3px]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className={cn(
                  'fixed left-1/2 top-[14vh] z-[96] w-[560px] max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-[18px] border border-seam-2 bg-soot text-bone shadow-[0_40px_120px_-20px_rgb(0_0_0/.75),0_0_0_1px_rgb(0_0_0/.3)] outline-none',
                  className,
                )}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              >
                <D.Title className="sr-only">{title}</D.Title>
                {children}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  )
}

/* --------------------------------- Status ---------------------------------- */
export type Status = 'running' | 'waiting' | 'done' | 'idle' | 'error'
export const statusColor: Record<Status, string> = {
  running: 'bg-brass', waiting: 'bg-ember', done: 'bg-sage', idle: 'bg-seam-2', error: 'bg-rose',
}
export const statusLabel: Record<Status, string> = {
  running: 'Working', waiting: 'Needs you', done: 'Done', idle: 'Idle', error: 'Failed',
}
export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return <span className={cn('inline-block size-[7px] shrink-0 rounded-full', statusColor[status], status === 'running' && 'breathe', className)} />
}

/* ---------------------------------- Badge ---------------------------------- */
export function Badge({ children, tone = 'default', className }: { children: React.ReactNode; tone?: 'default' | 'brass' | 'sage' | 'ember' | 'rose' | 'sky' | 'lilac'; className?: string }) {
  const tones = {
    default: 'text-dust border-seam-2 bg-slab-2',
    brass: 'text-brass border-brass/25 bg-brass/10',
    sage: 'text-sage border-sage/25 bg-sage/10',
    ember: 'text-ember border-ember/25 bg-ember/10',
    rose: 'text-rose border-rose/25 bg-rose/10',
    sky: 'text-sky border-sky/25 bg-sky/10',
    lilac: 'text-lilac border-lilac/25 bg-lilac/10',
  }
  return <span className={cn('inline-flex h-[19px] items-center gap-1 rounded-full border px-1.5 text-[11px] font-medium', tones[tone], className)}>{children}</span>
}

/* --------------------------------- Progress -------------------------------- */
export function Meter({ value, tone = 'brass', className }: { value: number; tone?: 'brass' | 'ember' | 'sage' | 'sky'; className?: string }) {
  const c = { brass: 'bg-brass', ember: 'bg-ember', sage: 'bg-sage', sky: 'bg-sky' }[tone]
  return (
    <div className={cn('h-[5px] overflow-hidden rounded-full bg-slab-2', className)}>
      <motion.div className={cn('h-full rounded-full', c)} initial={{ width: 0 }} animate={{ width: `${value * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
    </div>
  )
}

/* -------------------------------- Separator -------------------------------- */
export const Hr = ({ className }: { className?: string }) => <div className={cn('h-px bg-seam', className)} />
