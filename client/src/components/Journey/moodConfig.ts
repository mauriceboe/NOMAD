import { Sparkles, Sun, Minus, Moon, CloudRain, CloudSun, Cloud, CloudLightning, Snowflake, Thermometer, ThermometerSnowflake } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface MoodDef {
  id: string
  label: string
  icon: LucideIcon
  color: string
  cssVar: string
}

export const MOODS: MoodDef[] = [
  { id: 'amazing', label: 'Amazing', icon: Sparkles, color: '#E8654A', cssVar: 'var(--mood-amazing)' },
  { id: 'good',    label: 'Good',    icon: Sun,      color: '#EF9F27', cssVar: 'var(--mood-good)' },
  { id: 'neutral', label: 'Neutral', icon: Minus,    color: '#94928C', cssVar: 'var(--mood-neutral)' },
  { id: 'tired',   label: 'Tired',   icon: Moon,     color: '#6B9BD2', cssVar: 'var(--mood-tired)' },
  { id: 'rough',   label: 'Rough',   icon: CloudRain,color: '#9B8EC4', cssVar: 'var(--mood-rough)' },
]

export const MOOD_DEFAULT_COLOR = '#D4D4D4'

export function getMood(id: string | null | undefined): MoodDef | undefined {
  if (!id) return undefined
  return MOODS.find(m => m.id === id)
}

export function moodColor(id: string | null | undefined): string {
  return getMood(id)?.cssVar || 'var(--journal-faint)'
}

export interface WeatherDef {
  id: string
  label: string
  icon: LucideIcon
}

export const WEATHERS: WeatherDef[] = [
  { id: 'sunny',   label: 'Sunny',         icon: Sun },
  { id: 'partly',  label: 'Partly cloudy', icon: CloudSun },
  { id: 'cloudy',  label: 'Cloudy',        icon: Cloud },
  { id: 'rainy',   label: 'Rainy',         icon: CloudRain },
  { id: 'stormy',  label: 'Stormy',        icon: CloudLightning },
  { id: 'snowy',   label: 'Snowy',         icon: Snowflake },
  { id: 'hot',     label: 'Hot',           icon: Thermometer },
  { id: 'cold',    label: 'Cold',          icon: ThermometerSnowflake },
]

export function getWeather(id: string | null | undefined): WeatherDef | undefined {
  if (!id) return undefined
  return WEATHERS.find(w => w.id === id)
}

export const TAG_STYLES: Record<string, { bg: string; fg: string; darkBg: string; darkFg: string }> = {
  'hidden gem':   { bg: '#dcfce7', fg: '#166534', darkBg: 'rgba(22,101,52,0.2)',  darkFg: '#86efac' },
  'must revisit': { bg: '#dbeafe', fg: '#1e40af', darkBg: 'rgba(30,64,175,0.2)',  darkFg: '#93c5fd' },
  'best meal':    { bg: '#fef3c7', fg: '#92400e', darkBg: 'rgba(146,64,14,0.2)',  darkFg: '#fcd34d' },
  'tourist trap': { bg: '#fee2e2', fg: '#991b1b', darkBg: 'rgba(153,27,27,0.2)',  darkFg: '#fca5a5' },
  'disaster':     { bg: '#fce4ec', fg: '#880e4f', darkBg: 'rgba(136,14,79,0.2)',  darkFg: '#f48fb1' },
}

export function tagColors(tag: string, dark: boolean) {
  const known = TAG_STYLES[tag.toLowerCase()]
  if (known) return { bg: dark ? known.darkBg : known.bg, fg: dark ? known.darkFg : known.fg }
  return { bg: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', fg: dark ? '#a1a1aa' : '#374151' }
}
