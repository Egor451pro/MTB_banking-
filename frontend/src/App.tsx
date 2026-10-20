import { useEffect, useState, type ReactNode } from 'react'
import { api, session, usingMock, type LoginResult } from './api'
import { NavProvider, useNav } from './nav'
import { BonusBannerHost, BottomNav, ToastHost, Loading, toast, type TabDef } from './ui'
import { useData } from './hooks'
import type { Me } from './types'
import { ChildGoals, ChildHome, ChildLevel, ChildPay, ChildTasks, LessonScreen, RequestScreen } from './screens/child'
import { BeaverScreen } from './screens/beaver'
import { LoyaltyScreen } from './screens/shared'
import { ChildManage, PackageFlow, ParentHome, ParentProducts, ParentRequests, ParentTasks } from './screens/parent'
import { LoginScreen } from './screens/auth'
import { useTheme } from './theme'
import { Icon } from './icons'

function ParentShell() {
  const { tab, setTab, stack, back } = useNav()
  const fam = useData(() => api.getFamily(), [], 3000)
  const pp = useData(() => api.listPendingPurchases(), [], 3000)
  const pb = useData(() => api.listPendingBonuses(), [], 3000)
  const pending = (fam.data?.children.reduce((s, c) => s + c.pending_requests, 0) ?? 0) + (pp.data?.items.length ?? 0) + (pb.data?.items.length ?? 0)
  const tabs: TabDef[] = [
    { id: 'home', label: 'Главная', icon: 'home' },
    { id: 'products', label: 'Продукты', icon: 'card' },
    { id: 'requests', label: 'Запросы', icon: 'bell', badge: pending },
    { id: 'tasks', label: 'Задания', icon: 'tasks' },
  ]
  const top = stack[stack.length - 1]
  let body
  if (top?.name === 'child') body = <ChildManage key={top.params!.id} id={top.params!.id} />
  else if (top?.name === 'package') body = <PackageFlow />
  else if (top?.name === 'loyalty') body = <LoyaltyScreen onBack={back} />
  else if (tab === 'products') body = <ParentProducts />
  else if (tab === 'requests') body = <ParentRequests />
  else if (tab === 'tasks') body = <ParentTasks />
  else body = <ParentHome />
  return (
    <>
      <div className="flex-1 overflow-y-auto"><div key={screenKey(tab, top)} className="anim-screen">{body}</div></div>
      <BottomNav tabs={tabs} active={tab} onChange={setTab} />
    </>
  )
}

// Ключ экрана: при его смене экран плавно появляется заново
function screenKey(tab: string, top?: { name: string; params?: Record<string, unknown> }) {
  return top ? `${top.name}:${JSON.stringify(top.params ?? {})}` : `tab:${tab}`
}

function ChildShell({ me }: { me: Me }) {
  const { tab, setTab, stack, back } = useNav()
  const tabs: TabDef[] = [
    { id: 'home', label: 'Главная', icon: 'home' },
    { id: 'pay', label: 'Оплата', icon: 'card' },
    { id: 'goals', label: 'Цели', icon: 'target' },
    { id: 'pet', label: 'Бобёр', icon: 'heart' },
    { id: 'tasks', label: 'Задания', icon: 'tasks' },
    { id: 'level', label: 'Награды', icon: 'star' },
  ]
  const top = stack[stack.length - 1]
  let body
  if (top?.name === 'request') body = <RequestScreen {...(top.params ?? {})} />
  else if (top?.name === 'lesson') body = <LessonScreen key={top.params!.id} id={top.params!.id} />
  else if (top?.name === 'loyalty') body = <LoyaltyScreen onBack={back} />
  else if (tab === 'pay') body = <ChildPay meId={me.id} />
  else if (tab === 'goals') body = <ChildGoals meId={me.id} />
  else if (tab === 'pet') body = <BeaverScreen meId={me.id} ageGroup={me.age_group} />
  else if (tab === 'tasks') body = <ChildTasks />
  else if (tab === 'level') body = <ChildLevel meId={me.id} />
  else body = <ChildHome meId={me.id} />
  return (
    <>
      <div className="flex-1 overflow-y-auto"><div key={screenKey(tab, top)} className="anim-screen">{body}</div></div>
      <BottomNav tabs={tabs} active={tab} onChange={setTab} />
    </>
  )
}

function Phone({ uid }: { uid: number }) {
  const [me, setMe] = useState<Me | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    session.userId = uid
    api.getMe().then(setMe).catch((e: Error) => setErr(e.message))
  }, [uid])
  if (err) return <div className="p-6 text-center text-sm text-mt-red">Не удалось войти: {err}</div>
  if (!me) return <Loading />
  return (
    <NavProvider initialTab="home">
      <div className="flex h-full min-h-0 flex-1 flex-col">
        {me.role === 'parent' ? <ParentShell /> : <ChildShell me={me} />}
      </div>
    </NavProvider>
  )
}

function formatStatusTime() {
  const d = new Date()
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Строка как в симуляторе: время слева, остров по центру, сеть и батарея справа */
function StatusBar({ time }: { time: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 hidden sm:block">
      <div className="status-frost absolute inset-x-0 top-0 h-[72px]" />
      <div className="relative flex h-[54px] items-center justify-between px-7 text-[15px] font-semibold tracking-[-0.03em] text-mt-ink">
      <span className="w-[54px] tabular-nums leading-none">{time}</span>

      <div className="absolute left-1/2 top-1/2 h-[36px] w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black">
        <div className="absolute left-[24px] top-1/2 h-[9px] w-[9px] -translate-y-1/2 rounded-full bg-[#1a1a1a] ring-1 ring-[#2a2a2a]" />
        <div className="absolute right-[16px] top-1/2 h-[12px] w-[12px] -translate-y-1/2 rounded-full bg-[#0c0c0e] ring-1 ring-[#222]">
          <div className="absolute left-1/2 top-1/2 h-[4px] w-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1a2230]" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-[6px]">
        <svg width="19" height="12" viewBox="0 0 19 12" fill="currentColor" aria-hidden>
          <rect x="0" y="8" width="3.2" height="4" rx="0.7" />
          <rect x="4.8" y="5.5" width="3.2" height="6.5" rx="0.7" />
          <rect x="9.6" y="3" width="3.2" height="9" rx="0.7" />
          <rect x="14.4" y="0.5" width="3.2" height="11.5" rx="0.7" />
        </svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor" aria-hidden>
          <path d="M8.5 2c2.3 0 4.3 1 5.7 2.55l-1.4 1.35A5.6 5.6 0 0 0 8.5 4.3c-1.7 0-3.15.7-4.2 1.8L2.85 4.75A7.4 7.4 0 0 1 8.5 2Zm0 3.5c1.3 0 2.4.5 3.25 1.45L10.4 8.3A2.8 2.8 0 0 0 8.5 7.6c-.8 0-1.55.3-2.1.85L5.1 7.1A4.5 4.5 0 0 1 8.5 5.5Zm0 3.55c.7 0 1.25.55 1.25 1.25S9.2 11.55 8.5 11.55 7.25 11 7.25 10.3 7.8 9.05 8.5 9.05Z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden>
          <rect x="0.55" y="0.55" width="22" height="11.9" rx="3.4" stroke="currentColor" strokeOpacity="0.55" fill="none" strokeWidth="1.1" />
          <rect x="2" y="2" width="17.5" height="9" rx="2.1" fill="currentColor" />
          <path d="M24.3 4.1v4.8a2 2 0 0 0 0-4.8Z" fill="currentColor" opacity="0.5" />
        </svg>
      </div>
      </div>
    </div>
  )
}

/** Рамка как в Xcode: равный безель, статичный Dynamic Island, живое время */
function IPhoneFrame({ children }: { children: ReactNode }) {
  const [time, setTime] = useState(formatStatusTime)
  useEffect(() => {
    const tick = () => setTime(formatStatusTime())
    tick()
    const msToNextMinute = 60_000 - (Date.now() % 60_000) + 50
    let intervalId: ReturnType<typeof setInterval> | undefined
    const timeoutId = setTimeout(() => {
      tick()
      intervalId = setInterval(tick, 60_000)
    }, msToNextMinute)
    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  // Безель 8px со всех сторон: outer radius 52 → inner 44
  return (
    <div
      className="relative flex h-[calc(100dvh-44px)] w-full flex-col overflow-hidden bg-surface
        sm:h-[min(852px,calc(100dvh-88px))] sm:w-[393px] sm:max-w-[393px]
        sm:rounded-[52px] sm:border-[8px] sm:border-[#111111]
        sm:bg-[#111111] sm:shadow-[0_20px_60px_-16px_rgba(0,0,0,0.45)]"
    >
      {/* Боковые кнопки (вне равного безеля) */}
      <div className="pointer-events-none absolute -left-[11px] top-[100px] hidden h-[30px] w-[3px] rounded-l-[1px] bg-[#2a2a2a] sm:block" />
      <div className="pointer-events-none absolute -left-[11px] top-[158px] hidden h-[54px] w-[3px] rounded-l-[1px] bg-[#2a2a2a] sm:block" />
      <div className="pointer-events-none absolute -left-[11px] top-[224px] hidden h-[54px] w-[3px] rounded-l-[1px] bg-[#2a2a2a] sm:block" />
      <div className="pointer-events-none absolute -right-[11px] top-[190px] hidden h-[70px] w-[3px] rounded-r-[1px] bg-[#2a2a2a] sm:block" />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-surface sm:rounded-[44px]">
        <StatusBar time={time} />
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-[8px] z-30 flex justify-center">
          <div className="h-[5px] w-[134px] rounded-full bg-mt-ink/80" />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<LoginResult | null>(null)
  const { theme, toggle } = useTheme()
  // Сброс демо: данные на сервере/в mock, локальные прогрессы (бобёр, баннеры бонусов) и перезагрузка экранов
  const [resetKey, setResetKey] = useState(0)
  const resetDemo = async () => {
    await api.demoReset()
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('beaver:') || k.startsWith('bonusSeen:')).forEach((k) => localStorage.removeItem(k))
    } catch { /* без хранилища нечего чистить */ }
    setResetKey((k) => k + 1)
    toast('Демо-данные сброшены')
  }
  // session.userId выставляется до рендера экранов, чтобы первый запрос ушёл от нужного пользователя
  if (user) session.userId = user.id

  return (
    <div className="flex min-h-[100dvh] flex-col items-center sm:gap-4 sm:py-5">
      <div className="flex w-full items-center justify-center gap-2 bg-card px-3 py-2 ring-1 ring-line sm:w-auto sm:rounded-full sm:py-1.5 sm:pl-4 sm:shadow-sm">
        <span className="text-xs font-semibold text-muted">Демо{usingMock ? ' · mock' : ''}</span>
        {user ? (
          <>
            <span className="text-[13px] font-semibold text-mt-ink">{user.name}</span>
            <button
              type="button"
              onClick={() => { session.userId = 0; setUser(null) }}
              className="rounded-full bg-elevated px-3 py-1 text-[13px] font-semibold text-muted transition hover:text-mt-ink"
            >
              Выйти
            </button>
          </>
        ) : (
          <span className="text-[13px] font-medium text-muted">Вход в Moby</span>
        )}
        <button
          type="button"
          onClick={resetDemo}
          title="Сбросить демо-данные"
          className="flex items-center gap-1 rounded-full bg-elevated px-3 py-1 text-[13px] font-semibold text-muted transition hover:text-mt-ink"
        >
          <Icon name="refresh" size={14} />Сбросить демо
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-elevated text-mt-ink transition hover:opacity-80"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
      </div>
      <IPhoneFrame>
        <ToastHost />
        <BonusBannerHost />
        {user
          ? <div className="flex min-h-0 flex-1 flex-col pb-3"><Phone key={`${user.id}:${resetKey}`} uid={user.id} /></div>
          : <div className="flex-1 overflow-y-auto pb-5"><LoginScreen onSuccess={setUser} /></div>}
      </IPhoneFrame>
    </div>
  )
}
