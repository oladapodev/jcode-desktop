import claude from '@lobehub/icons-static-svg/icons/claude-color.svg?raw'
import openai from '@lobehub/icons-static-svg/icons/openai.svg?raw'
import gemini from '@lobehub/icons-static-svg/icons/gemini-color.svg?raw'
import openrouter from '@lobehub/icons-static-svg/icons/openrouter.svg?raw'
import copilot from '@lobehub/icons-static-svg/icons/githubcopilot.svg?raw'
import ollama from '@lobehub/icons-static-svg/icons/ollama.svg?raw'
import deepseek from '@lobehub/icons-static-svg/icons/deepseek-color.svg?raw'
import kimi from '@lobehub/icons-static-svg/icons/kimi-color.svg?raw'
import grok from '@lobehub/icons-static-svg/icons/grok.svg?raw'
import qwen from '@lobehub/icons-static-svg/icons/qwen-color.svg?raw'
import gcloud from '@lobehub/icons-static-svg/icons/googlecloud-color.svg?raw'
import cloudflare from '@lobehub/icons-static-svg/icons/cloudflare-color.svg?raw'
import aws from '@lobehub/icons-static-svg/icons/aws-color.svg?raw'
import github from 'simple-icons/icons/github.svg?raw'
import gmail from 'simple-icons/icons/gmail.svg?raw'
import sheets from 'simple-icons/icons/googlesheets.svg?raw'
import calendar from 'simple-icons/icons/googlecalendar.svg?raw'
import figma from 'simple-icons/icons/figma.svg?raw'
import tailscale from 'simple-icons/icons/tailscale.svg?raw'
import postgres from 'simple-icons/icons/postgresql.svg?raw'
import twitch from 'simple-icons/icons/twitch.svg?raw'
import youtube from 'simple-icons/icons/youtube.svg?raw'
import linux from 'simple-icons/icons/linux.svg?raw'
import { cn } from '@/lib/cn'

/** Brand marks. `mono` marks inherit currentColor so they sit quietly in UI. */
export const LOGOS = {
  claude: { svg: claude, mono: false, tint: '#d97757' },
  openai: { svg: openai, mono: true, tint: 'currentColor' },
  gemini: { svg: gemini, mono: false, tint: '#5b8def' },
  openrouter: { svg: openrouter, mono: true, tint: '#8f8cf5' },
  copilot: { svg: copilot, mono: true, tint: 'currentColor' },
  ollama: { svg: ollama, mono: true, tint: 'currentColor' },
  deepseek: { svg: deepseek, mono: false, tint: '#4d6bfe' },
  kimi: { svg: kimi, mono: false, tint: '#9aa0ff' },
  grok: { svg: grok, mono: true, tint: 'currentColor' },
  qwen: { svg: qwen, mono: false, tint: '#7a6cf5' },
  gcloud: { svg: gcloud, mono: false, tint: '#4285f4' },
  cloudflare: { svg: cloudflare, mono: false, tint: '#f38020' },
  aws: { svg: aws, mono: false, tint: '#ff9900' },
  github: { svg: github, mono: true, tint: 'currentColor' },
  gmail: { svg: gmail, mono: true, tint: '#ea4335' },
  sheets: { svg: sheets, mono: true, tint: '#34a853' },
  calendar: { svg: calendar, mono: true, tint: '#4285f4' },
  figma: { svg: figma, mono: true, tint: '#a259ff' },
  tailscale: { svg: tailscale, mono: true, tint: 'currentColor' },
  postgres: { svg: postgres, mono: true, tint: '#6b9ad8' },
  twitch: { svg: twitch, mono: true, tint: '#9146ff' },
  youtube: { svg: youtube, mono: true, tint: '#ff3d3d' },
  linux: { svg: linux, mono: true, tint: 'currentColor' },
} as const

export type LogoName = keyof typeof LOGOS

export function Logo({ name, size = 16, tinted, className }: { name: LogoName; size?: number; tinted?: boolean; className?: string }) {
  const l = LOGOS[name]
  return (
    <span
      aria-hidden
      className={cn('logo-svg inline-block shrink-0', l.mono && 'logo-mono', className)}
      style={{ width: size, height: size, color: tinted && l.mono && l.tint !== 'currentColor' ? l.tint : undefined }}
      dangerouslySetInnerHTML={{ __html: l.svg }}
    />
  )
}

/** A logo inside a soft tile, used for providers and apps. */
export function LogoTile({ name, size = 32, className }: { name: LogoName; size?: number; className?: string }) {
  const l = LOGOS[name]
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-[10px] border border-seam bg-slab-2 text-bone', className)}
      style={{ width: size, height: size, boxShadow: l.tint === 'currentColor' ? undefined : `inset 0 0 0 1px ${l.tint}14, 0 1px 0 0 ${l.tint}10` }}
    >
      <Logo name={name} size={Math.round(size * 0.52)} tinted />
    </span>
  )
}
