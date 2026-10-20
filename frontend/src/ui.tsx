import { useEffect, useRef, useState, type ReactNode } from 'react'
import { money } from './format'
import { Icon, type IconName } from './icons'
import type { Card as CardT } from './types'

// Дизайн-система в стиле приложения Moby и цветах МТБанка:
// серый фон, белые плоские карточки, голубая градиентная шапка со скруглённым низом,
// синие линейные иконки, нижнее меню с «таблеткой» на активной вкладке.
// Красный — акцент и отказы, оранжевый — только в паре с красным.

const BLUE = 'text-[#2F6FE4]'
const GRAD = 'bg-gradient-to-b from-[#3D74EC] to-[#2B5FDB]'

// ───────── Уведомление ─────────
export const toast = (msg: string) => window.dispatchEvent(new CustomEvent('app-toast', { detail: msg }))

// Крупная плашка с иконкой: «Поступил бонус от родителя»
export const bonusBanner = (title: string, text: string) =>
  window.dispatchEvent(new CustomEvent('app-bonus', { detail: { title, text } }))

export function BonusBannerHost() {
  const [b, setB] = useState<{ title: string; text: string; id: number; leaving: boolean } | null>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>
    const h = (e: Event) => {
      clearTimeout(t); clearTimeout(t2)
      const d = (e as CustomEvent<{ title: string; text: string }>).detail
      setB({ ...d, id: Date.now(), leaving: false })
      t = setTimeout(() => setB((m) => (m ? { ...m, leaving: true } : m)), 4600)
      t2 = setTimeout(() => setB(null), 4850)
    }
    window.addEventListener('app-bonus', h)
    return () => { window.removeEventListener('app-bonus', h); clearTimeout(t); clearTimeout(t2) }
  }, [])
  if (!b) return null
  return (
    <div
      key={b.id} role="status" onClick={() => setB(null)}
      className={`absolute inset-x-3 top-3 z-50 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl ring-1 ring-black/5 ${b.leaving ? 'anim-toast-out' : 'anim-toast'}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mt-blue text-white"><Icon name="gift" size={22} /></span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-mt-ink">{b.title}</span>
        <span className="block text-[13px] text-muted">{b.text}</span>
      </span>
    </div>
  )
}

export function ToastHost() {
  const [msg, setMsg] = useState<{ text: string; id: number; leaving: boolean } | null>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>
    const h = (e: Event) => {
      clearTimeout(t); clearTimeout(t2)
      setMsg({ text: (e as CustomEvent<string>).detail, id: Date.now(), leaving: false })
      t = setTimeout(() => setMsg((m) => (m ? { ...m, leaving: true } : m)), 2600)
      t2 = setTimeout(() => setMsg(null), 2850)
    }
    window.addEventListener('app-toast', h)
    return () => { window.removeEventListener('app-toast', h); clearTimeout(t); clearTimeout(t2) }
  }, [])
  if (!msg) return null
  return (
    <div
      key={msg.id}
      className={`pointer-events-none absolute inset-x-4 top-4 z-50 rounded-2xl bg-mt-ink/90 px-4 py-3 text-center text-sm font-medium text-white shadow-lg backdrop-blur ${msg.leaving ? 'anim-toast-out' : 'anim-toast'}`}
    >
      {msg.text}
    </div>
  )
}

// Плавно «докручивает» число до нового значения (для сумм на картах)
export function useCountUp(value: number, ms = 650): number {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    if (start === value || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      from.current = value; setShown(value); return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      const v = Math.round(start + (value - start) * e)
      from.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}

// Значение, которое на первом кадре равно 0, а потом плавно растёт (для полосок и колец)
export function useGrow(target: number): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    const r = requestAnimationFrame(() => setV(target))
    return () => cancelAnimationFrame(r)
  }, [target])
  return v
}

// ───────── Поверхности ─────────
export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[20px] bg-white p-4 ${onClick ? 'cursor-pointer transition active:scale-[0.99] active:bg-[#FAFBFD]' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[22px] font-bold tracking-tight text-mt-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

// ───────── Кнопки ─────────
type Tone = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost'
const BTN: Record<Tone, string> = {
  primary: `${GRAD} text-white shadow-[0_8px_18px_-8px_rgba(43,95,219,0.75)]`,
  accent: 'bg-gradient-to-r from-mt-red to-mt-orange text-white shadow-[0_8px_18px_-8px_rgba(228,44,38,0.7)]',
  secondary: `bg-[#E9F1FE] ${BLUE}`,
  danger: 'bg-white text-mt-red ring-1 ring-mt-red/25',
  ghost: `bg-transparent ${BLUE}`,
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
        ${small ? 'h-10 rounded-xl px-4 text-sm' : 'h-12 rounded-2xl px-5 text-[15px]'} ${BTN[tone]}`}
    >
      {icon && <Icon name={icon} size={small ? 18 : 20} />}
      {children}
    </button>
  )
}

// Плавающая кнопка-«таблетка», как «Оформить» в Moby
export function FloatAction({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <div className="sticky bottom-3 z-10 px-4 pt-2">
      <button
        onClick={onClick}
        className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-white text-[17px] font-medium text-mt-ink shadow-[0_8px_28px_rgba(20,20,22,0.14)] transition active:scale-[0.98]"
      >
        <Icon name={icon} size={26} className={BLUE} />
        {label}
      </button>
    </div>
  )
}

// ───────── Метки и индикаторы ─────────
export type BadgeTone = 'blue' | 'solid' | 'red' | 'redsoft' | 'sky' | 'gray'
const BADGE: Record<BadgeTone, string> = {
  blue: `bg-[#E9F1FE] ${BLUE}`,
  solid: 'bg-[#2B5FDB] text-white',
  red: 'bg-mt-red text-white',
  redsoft: 'bg-[#FDECEB] text-mt-red',
  sky: 'bg-mt-sky/40 text-mt-ink',
  gray: 'bg-[#EEF0F4] text-muted',
}
export function Badge({ children, tone = 'blue' }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-semibold ${BADGE[tone]}`}>{children}</span>
}

// tone="brand" — фирменная пара красный→оранжевый, только для опыта и уровня
export function Progress({ value, max, tone = 'blue' }: { value: number; max: number; tone?: 'blue' | 'brand' }) {
  const pct = useGrow(max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0)
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${tone === 'brand' ? 'bg-gradient-to-r from-mt-red to-mt-orange' : 'bg-gradient-to-r from-[#6AA6F3] to-[#2B5FDB]'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

type TileTone = 'blue' | 'red' | 'solid' | 'gray'
const TILE: Record<TileTone, string> = {
  blue: `bg-[#E9F1FE] ${BLUE}`,
  red: 'bg-[#FDECEB] text-mt-red',
  solid: `${GRAD} text-white`,
  gray: 'bg-[#EEF0F4] text-muted',
}
export function IconTile({ name, tone = 'blue', size = 40 }: { name: IconName; tone?: TileTone; size?: number }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-[14px] ${TILE[tone]}`} style={{ width: size, height: size }}>
      <Icon name={name} size={Math.round(size * 0.52)} />
    </div>
  )
}

// light — квадратная аватарка на голубой шапке, как в Moby
export function Avatar({ name, size = 40, light }: { name: string; size?: number; light?: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center font-bold ${light ? 'rounded-2xl bg-white/20 text-white' : `rounded-full ${GRAD} text-white`}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </div>
  )
}

export function Note({ children, tone = 'blue', icon = 'shield' }: { children: ReactNode; tone?: 'blue' | 'red'; icon?: IconName }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-[20px] px-4 py-3.5 text-sm ${tone === 'red' ? 'bg-[#FDECEB] text-mt-red' : `bg-white ${BLUE}`}`}>
      <Icon name={icon} size={20} />
      <div className="font-medium">{children}</div>
    </div>
  )
}

// ───────── Ввод ─────────
export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition disabled:opacity-40 ${on ? 'bg-[#2F6FE4]' : 'bg-[#D3D8E0]'}`}
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
          className="h-12 w-full rounded-2xl border border-[#DDE2EA] bg-white px-4 text-[15px] text-mt-ink outline-none transition placeholder:text-[#A3ABB8] focus:border-[#2F6FE4] focus:ring-2 focus:ring-[#2F6FE4]/15"
        />
        {suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-muted">{suffix}</span>}
      </div>
    </label>
  )
}

export function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void
}) {
  // Синяя «таблетка» плавно переезжает под выбранный вариант
  const idx = Math.max(0, options.findIndex((o) => o.id === value))
  return (
    <div className="relative flex rounded-2xl bg-white p-1">
      <div
        className={`absolute bottom-1 left-1 top-1 rounded-xl ${GRAD} shadow-[0_6px_14px_-8px_rgba(43,95,219,0.8)] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]`}
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={String(o.id)}
          onClick={() => onChange(o.id)}
          className={`relative h-9 flex-1 rounded-xl px-2 text-sm font-semibold transition-colors duration-300 ${value === o.id ? 'text-white' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ───────── Шторка ─────────
// Выезжает снизу и уезжает обратно; на время закрытия держим последнее содержимое
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(open)
  const [leaving, setLeaving] = useState(false)
  const last = useRef<{ title?: string; children: ReactNode }>({ title, children })
  if (open) last.current = { title, children }
  useEffect(() => {
    if (open) { setMounted(true); setLeaving(false); return }
    if (!mounted) return
    setLeaving(true)
    const t = setTimeout(() => { setMounted(false); setLeaving(false) }, 240)
    return () => clearTimeout(t)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!open && !mounted) return null
  const c = last.current
  return (
    <div
      className={`sheet-backdrop absolute inset-0 z-30 flex items-end bg-mt-ink/45 ${leaving ? 'anim-backdrop-out pointer-events-none' : 'anim-backdrop'}`}
      onClick={onClose}
    >
      <div
        className={`max-h-[88%] w-full overflow-y-auto rounded-t-[28px] bg-white px-5 pb-8 pt-3 ${leaving ? 'anim-sheet-out' : 'anim-sheet'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D5DAE2]" />
        {c.title && <h3 className="mb-4 text-xl font-bold tracking-tight text-mt-ink">{c.title}</h3>}
        {c.children}
      </div>
    </div>
  )
}

// ───────── Шапка ─────────
// Голубой градиент со скруглённым низом, как главная Moby.
// tall — шапка выше обычной, а первая карточка экрана заходит на неё (класс -mt-12)
export function Header({ title, subtitle, onBack, right, tall }: {
  title: string; subtitle?: string; onBack?: () => void; right?: ReactNode; tall?: boolean
}) {
  return (
    <div className={`rounded-b-[32px] bg-gradient-to-b from-[#2B5FDB] to-[#6AA6F3] px-4 pt-6 text-white ${tall ? 'pb-16' : 'pb-6'}`}>
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} aria-label="Назад" className="-ml-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 transition hover:bg-white/30">
            <Icon name="chevron-left" size={22} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-white/80">{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  )
}

// ───────── Баланс ─────────
// Рубли крупно, копейки и валюта мельче — сумма читается с одного взгляда
export function MoneyBig({ cents, muted }: { cents: number; muted?: boolean }) {
  const s = money(useCountUp(cents))
  const i = s.indexOf(',')
  return (
    <span className={`tabular-nums ${muted ? 'text-[#A3ABB8]' : 'text-mt-ink'}`}>
      <span className="text-[30px] font-bold tracking-tight">{s.slice(0, i)}</span>
      <span className="text-[18px] font-semibold text-muted">{s.slice(i)}</span>
    </span>
  )
}

// Миниатюра карты, как у счёта в Moby
export function MiniCard({ last4, blocked }: { last4: string; blocked?: boolean }) {
  return (
    <div className={`relative h-[46px] w-[72px] shrink-0 overflow-hidden rounded-[10px] ${blocked ? 'bg-gradient-to-br from-[#9AA3B2] to-[#5E6878]' : 'bg-gradient-to-br from-[#121C6E] via-[#2334C8] to-[#5B8CF0]'}`}>
      <div className="absolute -right-4 -top-5 h-12 w-12 rounded-full bg-white/25 blur-md" />
      <div className="absolute bottom-1 right-1.5 text-[9px] font-semibold tracking-wider text-white/90">•• {last4}</div>
    </div>
  )
}

export function BalanceCard({ card, title, limit }: {
  card: CardT; title: string
  limit?: { limit_cents: number | null; spent_cents: number; left_cents: number | null }
}) {
  const blocked = card.status === 'blocked'
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[0_10px_30px_-18px_rgba(20,20,22,0.35)]">
      <div className="flex items-center gap-4">
        <MiniCard last4={card.last4} blocked={blocked} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#A3ABB8]">{title}</div>
          <MoneyBig cents={card.balance_cents} muted={blocked} />
        </div>
      </div>
      {blocked && (
        <div className="mt-4"><Badge tone="red"><Icon name="lock" size={14} />Карта заблокирована</Badge></div>
      )}
      {!blocked && limit && limit.limit_cents != null && (
        <div className="mt-4 space-y-2 border-t border-[#EEF0F4] pt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted">Можно потратить сегодня</span>
            <span className="font-semibold tabular-nums text-mt-ink">{money(limit.left_cents ?? 0)}</span>
          </div>
          <Progress value={limit.left_cents ?? 0} max={limit.limit_cents} />
          <div className="text-xs tabular-nums text-muted">Лимит {money(limit.limit_cents)} в день · потрачено {money(limit.spent_cents)}</div>
        </div>
      )}
      {!blocked && limit && limit.limit_cents == null && (
        <div className="mt-4 border-t border-[#EEF0F4] pt-3 text-sm text-muted">Дневной лимит не установлен</div>
      )}
    </div>
  )
}

// ───────── Навигация ─────────
// Белая панель со скруглённым верхом, активная вкладка — серая «таблетка», как в Moby
export interface TabDef { id: string; label: string; icon: IconName; badge?: number }
export function BottomNav({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  return (
    <nav className="flex gap-1 rounded-t-[32px] bg-white px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-6px_24px_rgba(20,20,22,0.07)]">
      {tabs.map((t) => {
        const on = active === t.id
        return (
          <button
            key={t.id} onClick={() => onChange(t.id)}
            className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-[22px] py-2 text-[11px] font-semibold transition ${on ? `bg-[#EEF0F4] ${BLUE}` : 'text-mt-ink'}`}
          >
            <span key={on ? 'on' : 'off'} className={on ? 'anim-tab' : ''}><Icon name={t.icon} size={24} strokeWidth={on ? 2 : 1.7} /></span>
            {t.label}
            {!!t.badge && (
              <span className="absolute left-1/2 top-1 ml-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-mt-red px-1 text-[10px] font-bold text-white">
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
    <div className="flex flex-col items-center gap-3 rounded-[20px] bg-white py-8 text-center">
      <IconTile name={icon} size={52} />
      <div className={`px-6 text-[15px] font-medium ${BLUE}`}>{text}</div>
    </div>
  )
}

export function Loading() {
  return (
    <div className="space-y-3 p-4">
      <div className="h-32 animate-pulse rounded-[24px] bg-white" />
      <div className="h-16 animate-pulse rounded-[20px] bg-white/80" />
      <div className="h-16 animate-pulse rounded-[20px] bg-white/60" />
    </div>
  )
}

// Строка списка: иконка, заголовок, подпись, что-то справа.
// plain — иконка без плашки, как в списке «Продукты» Moby
export function Row({ icon, iconTone, title, sub, right, onClick, chevron, plain }: {
  icon?: IconName; iconTone?: TileTone; title: ReactNode; sub?: ReactNode; right?: ReactNode
  onClick?: () => void; chevron?: boolean; plain?: boolean
}) {
  return (
    <div onClick={onClick} className={`flex items-center gap-3.5 px-4 py-3 ${onClick ? 'cursor-pointer transition active:bg-[#F6F7F9]' : ''}`}>
      {icon && (plain ? <Icon name={icon} size={30} strokeWidth={1.6} className={BLUE} /> : <IconTile name={icon} tone={iconTone} />)}
      <div className="min-w-0 flex-1">
        <div className={`truncate text-mt-ink ${plain ? 'text-[17px] font-semibold' : 'text-[15px] font-medium'}`}>{title}</div>
        {sub && <div className={`leading-snug text-[#8E97A6] ${plain ? 'mt-0.5 text-sm' : 'text-[13px]'}`}>{sub}</div>}
      </div>
      {right}
      {chevron && <Icon name="chevron-right" size={20} className="text-[#A3ABB8]" />}
    </div>
  )
}
