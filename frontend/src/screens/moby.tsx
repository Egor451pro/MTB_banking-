import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { money } from '../format'
import { useNav } from '../nav'

// Демо-оболочка приложения Moby: так наш раздел «Семья» выглядит внутри банковского приложения.
// Родитель после входа попадает на главную Moby, а вкладка «Семья» в нижнем меню
// открывает наш раздел. Ребёнок сразу попадает в детский интерфейс, без этой оболочки.

type MobyTab = 'home' | 'products' | 'family' | 'chat' | 'more'
type Mode = 'moby' | 'opening' | 'family' | 'closing'

const OPEN_MS = 560
const CLOSE_MS = 480
const EASE = 'cubic-bezier(.32,.72,0,1)' // кривая системных переходов iOS

// ───────── Иконки нижнего меню и главной (контурные, как в Moby) ─────────
function I({ children, size = 26 }: { children: ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
}
const IcCards = () => <I><rect x="3" y="8" width="16" height="11" rx="2" /><path d="M6 5h13a2 2 0 0 1 2 2v9" /></I>
const IcChat = () => <I><path d="M4 5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M17 9h3a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1v3l-3-3h-4" /></I>
const IcMore = () => <I><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></I>
const IcFamily = () => <I><circle cx="8" cy="7.5" r="2.6" /><circle cx="16.5" cy="9.5" r="2" /><path d="M3.5 19c.4-3.3 2.2-5.2 4.5-5.2s4.1 1.9 4.5 5.2" /><path d="M13.2 19c.3-2.4 1.6-3.8 3.3-3.8s3 1.4 3.3 3.8" /></I>
const IcUser = () => <I size={30}><circle cx="12" cy="9" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" /></I>
const IcHistory = () => <I size={24}><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3.5 4.5v4h4" /><path d="M12 8v4.5l3 1.8" /></I>
const IcNewCard = () => <I size={26}><rect x="3" y="5" width="16" height="12" rx="2" /><path d="M3 9h16M17 15v6M14 18h6" /></I>

/** Логотип-буква в духе Moby: градиент от синего к красному */
function MobyMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden>
      <defs>
        <linearGradient id="moby-m" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3D74EC" />
          <stop offset=".55" stopColor="#8A4FE0" />
          <stop offset="1" stopColor="#E42C26" />
        </linearGradient>
      </defs>
      <path d="M3 22V6.5C3 4.6 5.3 3.7 6.6 5.1L13 12l6.4-6.9C20.7 3.7 23 4.6 23 6.5V22h-5V12.6l-5 5.3-5-5.3V22z" fill="url(#moby-m)" />
    </svg>
  )
}

// ───────── Главная Moby ─────────
function MobyHome({ name, onFamily }: { name: string; onFamily: (from: HTMLElement) => void }) {
  return (
    <div className="min-h-full bg-surface pb-6">
      <div className="rounded-b-[34px] bg-gradient-to-b from-[#2F6BE6] to-[#5B95F2] px-6 pb-8 pt-[max(env(safe-area-inset-top),24px)] text-white sm:pt-[74px]">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20"><IcUser /></div>
          <div className="text-[19px] font-semibold">{name}</div>
        </div>
        <div className="mt-6 rounded-2xl bg-white/15 px-4 py-3">
          <div className="text-[13px] text-white/80">Карта •• 0427</div>
          <div className="mt-0.5 text-[22px] font-semibold tabular-nums">{money(124350)}</div>
        </div>
      </div>
      <div className="-mt-3 mx-0 rounded-b-[34px] bg-card px-6 pb-5 pt-7">
        <button type="button" className="mx-auto flex items-center gap-3 text-[17px] font-medium text-[#2F6BE6]"><IcNewCard />Открыть новую карту</button>
      </div>

      <div className="space-y-4 px-4 pt-4">
        <div className="flex gap-3">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-card text-[#2F6BE6]"><IcHistory /></div>
          <div className="flex flex-1 items-center justify-center gap-2 rounded-[22px] bg-card px-3 text-[14px] text-[#2F6BE6]">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2F6BE6] text-[10px] font-bold text-white">i</span>
            Операции за 3 дня: 4
          </div>
        </div>

        {/* Баннер нашего раздела — второй вход в «Семью», кроме нижнего меню */}
        <button type="button" onClick={(e) => onFamily(e.currentTarget)} className="relative flex h-[84px] w-full items-center overflow-hidden rounded-[22px] bg-gradient-to-r from-[#2334C8] to-[#2F6BE6] px-5 text-left text-white">
          <div className="absolute -right-6 -top-8 h-32 w-32 rounded-full bg-[#E42C26]" />
          <div className="absolute -right-2 top-10 h-[90px] w-40 rotate-[-18deg] bg-[#FF5912]" />
          <div className="relative z-10">
            <div className="font-display text-[19px] font-extrabold uppercase tracking-wide">Семья в Moby</div>
            <div className="text-[13px] text-white/85">Детские карты, копилки и бобёр</div>
          </div>
        </button>

        <div className="pt-2 text-[24px] font-bold text-mt-ink">Счета</div>
        <div className="flex items-center gap-4 rounded-[22px] bg-card px-5 py-4">
          <div className="h-12 w-[74px] rounded-xl bg-gradient-to-br from-[#1B289E] via-[#2334C8] to-[#5A3FD0]" />
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Текущий счёт</div>
            <div className="text-[18px] font-bold tabular-nums text-mt-ink">{money(124350)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MobyStub({ title }: { title: string }) {
  return (
    <div className="min-h-full bg-surface px-6 pt-[max(env(safe-area-inset-top),24px)] sm:pt-[74px]">
      <div className="text-[28px] font-bold text-mt-ink">{title}</div>
      <div className="mt-6 rounded-[22px] bg-card px-5 py-6 text-[15px] text-muted">Раздел приложения Moby. В демо работает вкладка «Семья».</div>
    </div>
  )
}

// ───────── Нижнее меню Moby с новой вкладкой «Семья» ─────────
function MobyNav({ active, onPick, familyRef }: { active: MobyTab; onPick: (t: MobyTab) => void; familyRef: React.RefObject<HTMLButtonElement> }) {
  const items: { id: MobyTab; label: string; icon: ReactNode }[] = [
    { id: 'home', label: 'Главная', icon: <MobyMark /> },
    { id: 'products', label: 'Продукты', icon: <IcCards /> },
    { id: 'family', label: 'Семья', icon: <IcFamily /> },
    { id: 'chat', label: 'Чат', icon: <IcChat /> },
    { id: 'more', label: 'Ещё', icon: <IcMore /> },
  ]
  return (
    <nav className="flex gap-1 rounded-t-[32px] bg-card px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-6px_24px_rgba(20,20,22,0.07)] ring-1 ring-line">
      {items.map((t) => {
        const on = active === t.id
        return (
          <button
            key={t.id} type="button" ref={t.id === 'family' ? familyRef : undefined} onClick={() => onPick(t.id)}
            className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-[22px] py-2 text-[12px] ${on ? 'bg-elevated text-[#2F6BE6]' : 'text-mt-ink'}`}
          >
            {t.icon}
            {t.label}
            {t.id === 'family' && <span className="absolute right-[18%] top-1.5 h-2 w-2 rounded-full bg-[#E42C26]" />}
          </button>
        )
      })}
    </nav>
  )
}

/** Moby + наш раздел. Переход как открытие приложения на iPhone: вкладка «Семья»
 *  превращается в скруглённую карточку и растягивается на весь экран, Moby уходит назад.
 *  Закрытие — обратно в ту же вкладку (или баннер, если открыли с него). */
export function MobyShell({ name, family }: { name: string; family: (onExit: () => void) => ReactNode }) {
  const { setTab } = useNav()
  const [tab, setMobyTab] = useState<MobyTab>('home')
  const [mode, setMode] = useState<Mode>('moby')
  const rootRef = useRef<HTMLDivElement>(null)
  const mobyRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const coverRef = useRef<HTMLDivElement>(null)
  const familyBtn = useRef<HTMLButtonElement>(null)
  const fromShape = useRef('inset(88% 40% 3% 40% round 22px)')

  // Прямоугольник элемента внутри экрана в виде clip-path, с которого начинается переход
  const shapeOf = (el: HTMLElement | null) => {
    const root = rootRef.current?.getBoundingClientRect()
    const r = el?.getBoundingClientRect()
    if (!root || !r) return fromShape.current
    return `inset(${r.top - root.top}px ${root.right - r.right}px ${root.bottom - r.bottom}px ${r.left - root.left}px round 22px)`
  }

  const open = (from?: HTMLElement | null) => {
    if (mode !== 'moby') return
    fromShape.current = shapeOf(from ?? familyBtn.current)
    setTab('home')
    setMode('opening')
  }
  const close = () => {
    if (mode !== 'family') return
    setMode('closing')
  }

  useLayoutEffect(() => {
    const full = 'inset(0px 0px 0px 0px round 0px)'
    if (mode === 'opening') {
      layerRef.current?.animate([{ clipPath: fromShape.current }, { clipPath: full }], { duration: OPEN_MS, easing: EASE, fill: 'both' })
      contentRef.current?.animate([{ transform: 'scale(.9)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: OPEN_MS, easing: EASE, fill: 'both' })
      // синяя «иконка» раздела, которая тает по мере раскрытия
      coverRef.current?.animate([{ opacity: 1 }, { opacity: 0, offset: 0.45 }, { opacity: 0 }], { duration: OPEN_MS, easing: 'ease-out', fill: 'both' })
      mobyRef.current?.animate([{ transform: 'scale(1)', filter: 'brightness(1)', borderRadius: '0px' }, { transform: 'scale(.93)', filter: 'brightness(.55)', borderRadius: '32px' }], { duration: OPEN_MS, easing: EASE, fill: 'forwards' })
      const t = window.setTimeout(() => setMode('family'), OPEN_MS)
      return () => window.clearTimeout(t)
    }
    if (mode === 'closing') {
      layerRef.current?.animate([{ clipPath: full }, { clipPath: fromShape.current }], { duration: CLOSE_MS, easing: EASE, fill: 'both' })
      contentRef.current?.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.9)', opacity: 0 }], { duration: CLOSE_MS, easing: EASE, fill: 'both' })
      coverRef.current?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: CLOSE_MS, easing: 'ease-in', fill: 'both' })
      mobyRef.current?.animate([{ transform: 'scale(.93)', filter: 'brightness(.55)', borderRadius: '32px' }, { transform: 'scale(1)', filter: 'brightness(1)', borderRadius: '0px' }], { duration: CLOSE_MS, easing: EASE, fill: 'forwards' })
      const t = window.setTimeout(() => {
        mobyRef.current?.getAnimations().forEach((a) => a.cancel())
        setMode('moby')
        setMobyTab('home')
      }, CLOSE_MS)
      return () => window.clearTimeout(t)
    }
  }, [mode])

  const pick = (t: MobyTab) => {
    if (t === 'family') open()
    else setMobyTab(t)
  }

  return (
    <div ref={rootRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-black">
      <div ref={mobyRef} className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface" style={{ transformOrigin: '50% 60%' }}>
        <div className="flex-1 overflow-y-auto">
          {tab === 'home' && <MobyHome name={name} onFamily={open} />}
          {tab === 'products' && <MobyStub title="Продукты" />}
          {tab === 'chat' && <MobyStub title="Чат" />}
          {tab === 'more' && <MobyStub title="Ещё" />}
        </div>
        <MobyNav active={mode === 'moby' ? tab : 'family'} onPick={pick} familyRef={familyBtn} />
      </div>

      {mode !== 'moby' && (
        <div ref={layerRef} className="absolute inset-0 z-10 flex flex-col overflow-hidden bg-surface" style={{ clipPath: fromShape.current }}>
          <div ref={contentRef} className="flex min-h-0 flex-1 flex-col" style={{ transformOrigin: '50% 100%' }}>
            {family(close)}
          </div>
          <div ref={coverRef} className="pointer-events-none absolute inset-0 flex items-center justify-center text-white" style={{ background: 'linear-gradient(180deg, #2F6BE6, #2334C8)' }}>
            <IcFamily />
          </div>
        </div>
      )}
    </div>
  )
}
