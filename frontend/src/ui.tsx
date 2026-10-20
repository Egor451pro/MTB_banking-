import { useEffect, useState, type ReactNode } from 'react'
import { money } from './format'
import { Icon, type IconName } from './icons'
import type { Card as CardT } from './types'

// Дизайн-система прототипа в цветах МТБанка.
// Синий — основа (шапки, основные кнопки, активные элементы),
// красный — акцент (важное действие, тревога, отказ),
// оранжевый — только рядом с красным (шкала опыта).

// ───────── Уведомление ─────────
export const toast = (msg: string) => window.dispatchEvent(new CustomEvent('app-toast', { detail: msg }))

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const h = (e: Event) => { setMsg((e as CustomEvent<string>).detail); clearTimeout(t); t = setTimeout(() => setMsg(null), 2800) }
    window.addEventListener('app-toast', h)
    return () => { window.removeEventListener('app-toast', h); clearTimeout(t) }
  }, [])
  if (!msg) return null
  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-50 rounded-xl bg-mt-ink px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
      {msg}
    </div>
  )
}

// ───────── Поверхности ─────────
export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-line bg-white p-4 ${onClick ? 'cursor-pointer transition active:bg-[#F4F9FF]' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between px-0.5">
        <h2 className="text-[17px] font-bold tracking-tight text-mt-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

// ───────── Кнопки ─────────
type Tone = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost'
const BTN: Record<Tone, string> = {
  primary: 'bg-mt-blue text-white hover:bg-mt-blue-dark',
  accent: 'bg-mt-red text-white hover:brightness-95',
  secondary: 'bg-mt-cloud text-mt-blue hover:bg-[#D8ECFF]',
  danger: 'border border-mt-red/35 bg-white text-mt-red hover:bg-[#FDEDEC]',
  ghost: 'bg-transparent text-mt-blue hover:bg-mt-cloud',
}

export function Btn({ children, onClick, tone = 'primary', disabled, small, full = true, icon }: {
  children: ReactNode; onClick?: () => void | Promise<void>; tone?: Tone; disabled?: boolean
  small?: boolean; full?: boolean; icon?: IconName
}) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      disabled={disabled || busy}
      onClick={async () => {
        if (!onClick) return
        setBusy(true)
        try { await onClick() } catch (e) { toast((e as Error).message || 'Ошибка') } finally { setBusy(false) }
      }}
      className={`${full ? 'w-full' : ''} inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.98] disabled:opacity-40
        ${small ? 'h-10 rounded-[10px] px-4 text-sm' : 'h-12 rounded-xl px-5 text-[15px]'} ${BTN[tone]}`}
    >
      {icon && <Icon name={icon} size={small ? 18 : 20} />}
      {children}
    </button>
  )
}

// ───────── Метки и индикаторы ─────────
export type BadgeTone = 'blue' | 'solid' | 'red' | 'redsoft' | 'sky' | 'gray'
const BADGE: Record<BadgeTone, string> = {
  blue: 'bg-mt-cloud text-mt-blue',
  solid: 'bg-mt-blue text-white',
  red: 'bg-mt-red text-white',
  redsoft: 'bg-[#FDECEB] text-mt-red',
  sky: 'bg-mt-sky/40 text-mt-ink',
  gray: 'bg-[#EEF1F5] text-muted',
}
export function Badge({ children, tone = 'blue' }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${BADGE[tone]}`}>{children}</span>
}

// tone="brand" — фирменная пара красный→оранжевый, только для опыта и уровня
export function Progress({ value, max, tone = 'blue' }: { value: number; max: number; tone?: 'blue' | 'brand' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#E3EBF5]">
      <div
        className={`h-full rounded-full transition-all ${tone === 'brand' ? 'bg-gradient-to-r from-mt-red to-mt-orange' : 'bg-mt-blue'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

type TileTone = 'blue' | 'red' | 'solid' | 'gray'
const TILE: Record<TileTone, string> = {
  blue: 'bg-mt-cloud text-mt-blue',
  red: 'bg-[#FDECEB] text-mt-red',
  solid: 'bg-mt-blue text-white',
  gray: 'bg-[#EEF1F5] text-muted',
}
export function IconTile({ name, tone = 'blue', size = 40 }: { name: IconName; tone?: TileTone; size?: number }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl ${TILE[tone]}`} style={{ width: size, height: size }}>
      <Icon name={name} size={Math.round(size * 0.5)} />
    </div>
  )
}

export function Avatar({ name, size = 40, light }: { name: string; size?: number; light?: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${light ? 'bg-white/15 text-white' : 'bg-mt-blue text-white'}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </div>
  )
}

export function Note({ children, tone = 'blue', icon = 'shield' }: { children: ReactNode; tone?: 'blue' | 'red'; icon?: IconName }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ${tone === 'red' ? 'bg-[#FDECEB] text-mt-red' : 'bg-[#D3E9FF] text-mt-blue'}`}>
      <Icon name={icon} size={20} />
      <div className="pt-px font-medium">{children}</div>
    </div>
  )
}

// ───────── Ввод ─────────
export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition disabled:opacity-40 ${on ? 'bg-mt-blue' : 'bg-[#C9D5E3]'}`}
    >
      <span className={`absolute top-[2px] h-[26px] w-[26px] rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-[2px]'}`} />
    </button>
  )
}

export function Field({ label, value, onChange, placeholder, type = 'text', inputMode, suffix }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
  inputMode?: 'decimal' | 'numeric' | 'text'; suffix?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      <div className="relative">
        <input
          type={type} inputMode={inputMode} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-mt-ink outline-none transition placeholder:text-[#9AA6B8] focus:border-mt-blue focus:ring-2 focus:ring-mt-blue/15"
        />
        {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">{suffix}</span>}
      </div>
    </label>
  )
}

export function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-xl bg-[#E1EAF4] p-1">
      {options.map((o) => (
        <button
          key={String(o.id)}
          onClick={() => onChange(o.id)}
          className={`h-9 flex-1 rounded-[10px] px-2 text-sm font-semibold transition ${value === o.id ? 'bg-white text-mt-blue shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ───────── Шторка ─────────
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-mt-ink/50" onClick={onClose}>
      <div className="max-h-[88%] w-full overflow-y-auto rounded-t-[22px] bg-white px-5 pb-8 pt-3" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D5DDE8]" />
        {title && <h3 className="mb-4 text-xl font-bold tracking-tight text-mt-ink">{title}</h3>}
        {children}
      </div>
    </div>
  )
}

// ───────── Шапка ─────────
// tall — шапка выше обычной, а первая карточка экрана заходит на неё (класс -mt-12)
export function Header({ title, subtitle, onBack, right, tall }: {
  title: string; subtitle?: string; onBack?: () => void; right?: ReactNode; tall?: boolean
}) {
  return (
    <div className={`bg-mt-blue px-4 pt-5 text-white ${tall ? 'pb-16' : 'pb-5'}`}>
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} aria-label="Назад" className="-ml-1 flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/10 transition hover:bg-white/20">
            <Icon name="chevron-left" size={22} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-white/75">{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  )
}

// ───────── Баланс ─────────
// Рубли крупно, копейки и валюта мельче — сумма читается с одного взгляда
export function MoneyBig({ cents, muted }: { cents: number; muted?: boolean }) {
  const s = money(cents)
  const i = s.indexOf(',')
  return (
    <span className={`tabular-nums ${muted ? 'text-[#9AA6B8]' : 'text-mt-ink'}`}>
      <span className="text-[34px] font-bold tracking-tight">{s.slice(0, i)}</span>
      <span className="text-[20px] font-semibold text-muted">{s.slice(i)}</span>
    </span>
  )
}

export function BalanceCard({ card, title, limit }: {
  card: CardT; title: string
  limit?: { limit_cents: number | null; spent_cents: number; left_cents: number | null }
}) {
  const blocked = card.status === 'blocked'
  return (
    <div className="rounded-[20px] bg-white p-5 shadow-[0_12px_32px_-16px_rgba(20,20,22,0.35)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{title}</span>
        <span className={`flex h-7 items-center rounded-md px-2 text-[11px] font-semibold tracking-wide text-white ${blocked ? 'bg-[#8B95A7]' : 'bg-mt-blue'}`}>
          •• {card.last4}
        </span>
      </div>
      <div className="mt-1.5"><MoneyBig cents={card.balance_cents} muted={blocked} /></div>
      {blocked && (
        <div className="mt-3"><Badge tone="red"><Icon name="lock" size={14} />Карта заблокирована</Badge></div>
      )}
      {!blocked && limit && limit.limit_cents != null && (
        <div className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted">Можно потратить сегодня</span>
            <span className="font-semibold tabular-nums text-mt-ink">{money(limit.left_cents ?? 0)}</span>
          </div>
          <Progress value={limit.left_cents ?? 0} max={limit.limit_cents} />
          <div className="text-xs text-muted tabular-nums">Дневной лимит {money(limit.limit_cents)} · потрачено {money(limit.spent_cents)}</div>
        </div>
      )}
      {!blocked && limit && limit.limit_cents == null && (
        <div className="mt-3 text-sm text-muted">Дневной лимит не установлен</div>
      )}
    </div>
  )
}

// ───────── Навигация ─────────
export interface TabDef { id: string; label: string; icon: IconName; badge?: number }
export function BottomNav({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  return (
    <nav className="flex border-t border-line bg-white px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5">
      {tabs.map((t) => {
        const on = active === t.id
        return (
          <button key={t.id} onClick={() => onChange(t.id)} className={`relative flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${on ? 'text-mt-blue' : 'text-[#8792A6]'}`}>
            {on && <span className="absolute -top-1.5 h-[3px] w-8 rounded-b-full bg-mt-blue" />}
            <Icon name={t.icon} size={24} strokeWidth={on ? 2 : 1.8} />
            {t.label}
            {!!t.badge && (
              <span className="absolute left-1/2 top-0 ml-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-mt-red px-1 text-[10px] font-bold text-white">
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

// ───────── Состояния ─────────
export function Empty({ text, icon = 'check' }: { text: string; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <IconTile name={icon} tone="gray" size={44} />
      <div className="text-sm text-muted">{text}</div>
    </div>
  )
}

export function Loading() {
  return (
    <div className="space-y-3 p-4">
      <div className="h-32 animate-pulse rounded-2xl bg-white/80" />
      <div className="h-16 animate-pulse rounded-2xl bg-white/60" />
      <div className="h-16 animate-pulse rounded-2xl bg-white/50" />
    </div>
  )
}

// Строка списка: иконка, заголовок, подпись, что-то справа
export function Row({ icon, iconTone, title, sub, right, onClick, chevron }: {
  icon?: IconName; iconTone?: TileTone; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; chevron?: boolean
}) {
  return (
    <div onClick={onClick} className={`flex items-center gap-3 px-4 py-3 ${onClick ? 'cursor-pointer transition active:bg-[#F4F9FF]' : ''}`}>
      {icon && <IconTile name={icon} tone={iconTone} />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-mt-ink">{title}</div>
        {sub && <div className="text-[13px] leading-snug text-muted">{sub}</div>}
      </div>
      {right}
      {chevron && <Icon name="chevron-right" size={20} className="text-[#9AA6B8]" />}
    </div>
  )
}
