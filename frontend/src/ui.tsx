import { useEffect, useState, type ReactNode } from 'react'
import { money } from './format'
import type { Card as CardT } from './types'

// Короткое сообщение об ошибке/успехе; показывает ToastHost в App
export const toast = (msg: string) => window.dispatchEvent(new CustomEvent('app-toast', { detail: msg }))

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const h = (e: Event) => { setMsg((e as CustomEvent<string>).detail); clearTimeout(t); t = setTimeout(() => setMsg(null), 3000) }
    window.addEventListener('app-toast', h)
    return () => { window.removeEventListener('app-toast', h); clearTimeout(t) }
  }, [])
  if (!msg) return null
  return <div className="absolute inset-x-4 top-4 z-50 rounded-xl bg-slate-900/90 px-4 py-3 text-center text-sm text-white shadow-lg">{msg}</div>
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-2xl bg-white p-4 shadow-sm ${onClick ? 'cursor-pointer active:bg-slate-50' : ''} ${className}`}>
      {children}
    </div>
  )
}

type Tone = 'primary' | 'ghost' | 'danger' | 'ok'
export function Btn({ children, onClick, tone = 'primary', disabled, small, full = true }: {
  children: ReactNode; onClick?: () => void | Promise<void>; tone?: Tone; disabled?: boolean; small?: boolean; full?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const styles: Record<Tone, string> = {
    primary: 'bg-moby-600 text-white active:bg-moby-700',
    ghost: 'bg-moby-50 text-moby-700 active:bg-moby-100',
    danger: 'bg-red-50 text-red-600 active:bg-red-100',
    ok: 'bg-emerald-500 text-white active:bg-emerald-600',
  }
  return (
    <button
      disabled={disabled || busy}
      onClick={async () => {
        if (!onClick) return
        setBusy(true)
        try { await onClick() } catch (e) { toast((e as Error).message || 'Ошибка') } finally { setBusy(false) }
      }}
      className={`${full ? 'w-full' : ''} rounded-xl font-semibold transition disabled:opacity-50 ${small ? 'px-3 py-2 text-sm' : 'px-4 py-3'} ${styles[tone]}`}
    >
      {children}
    </button>
  )
}

export function Chip({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'green' | 'red' | 'gray' | 'amber' }) {
  const t = {
    blue: 'bg-moby-50 text-moby-700', green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-600', gray: 'bg-slate-100 text-slate-600', amber: 'bg-amber-50 text-amber-700',
  }[tone]
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${t}`}>{children}</span>
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-moby-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${on ? 'bg-moby-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export function Field({ label, value, onChange, placeholder, type = 'text', inputMode }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-500">{label}</span>
      <input
        type={type} inputMode={inputMode} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-moby-500"
      />
    </label>
  )
}

// Нижняя шторка для коротких форм и результата оплаты
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[85%] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
        {title && <h3 className="mb-3 text-lg font-bold">{title}</h3>}
        {children}
      </div>
    </div>
  )
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 bg-gradient-to-b from-moby-700 to-moby-600 px-4 pb-4 pt-5 text-white">
      {onBack && <button onClick={onBack} className="-ml-1 mr-1 text-2xl leading-none">‹</button>}
      <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
      {right}
    </div>
  )
}

export function BalanceCard({ card, title, sub }: { card: CardT; title: string; sub?: string }) {
  const blocked = card.status === 'blocked'
  return (
    <div className={`rounded-2xl p-4 text-white shadow ${blocked ? 'bg-slate-500' : 'bg-gradient-to-br from-moby-600 to-moby-900'}`}>
      <div className="flex items-center justify-between text-sm opacity-90">
        <span>{title}</span>
        <span>•••• {card.last4}</span>
      </div>
      <div className="mt-2 text-3xl font-bold">{money(card.balance_cents)}</div>
      <div className="mt-1 flex items-center justify-between text-sm opacity-90">
        <span>{sub}</span>
        {blocked && <span className="rounded-full bg-white/20 px-2 py-0.5">Заблокирована</span>}
      </div>
    </div>
  )
}

export interface TabDef { id: string; label: string; icon: string; badge?: number }
export function BottomNav({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  return (
    <nav className="flex border-t border-slate-200 bg-white pb-2 pt-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={`relative flex flex-1 flex-col items-center py-1 text-xs ${active === t.id ? 'font-semibold text-moby-600' : 'text-slate-500'}`}>
          <span className="text-xl">{t.icon}</span>
          {t.label}
          {!!t.badge && <span className="absolute right-[22%] top-0 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{t.badge}</span>}
        </button>
      ))}
    </nav>
  )
}

export function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-slate-400">{text}</div>
}

export function Loading() {
  return <div className="py-10 text-center text-slate-400">Загрузка…</div>
}

export function ErrorNote({ text }: { text: string | null }) {
  return text ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{text}</div> : null
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  )
}
