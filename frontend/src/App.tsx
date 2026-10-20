import { useEffect, useState } from 'react'
import { api, session, usingMock, type LoginResult } from './api'
import { NavProvider, useNav } from './nav'
import { BonusBannerHost, BottomNav, ToastHost, Loading, type TabDef } from './ui'
import { useData } from './hooks'
import type { Me } from './types'
import { ChildGoals, ChildHome, ChildLevel, ChildPay, ChildTasks, LessonScreen, RequestScreen } from './screens/child'
import { LoyaltyScreen } from './screens/shared'
import { ChildManage, PackageFlow, ParentHome, ParentProducts, ParentRequests, ParentTasks } from './screens/parent'
import { LoginScreen } from './screens/auth'

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
      {me.role === 'parent' ? <ParentShell /> : <ChildShell me={me} />}
    </NavProvider>
  )
}

export default function App() {
  const [user, setUser] = useState<LoginResult | null>(null)
  // session.userId выставляется до рендера экранов, чтобы первый запрос ушёл от нужного пользователя
  if (user) session.userId = user.id

  return (
    <div className="flex min-h-[100dvh] flex-col items-center sm:gap-4 sm:py-5">
      <div className="flex w-full items-center justify-center gap-2 bg-white px-3 py-2 sm:w-auto sm:rounded-full sm:py-1.5 sm:pl-4 sm:shadow-sm">
        <span className="text-xs font-semibold text-muted">Демо{usingMock ? ' · mock' : ''}</span>
        {user ? (
          <>
            <span className="text-[13px] font-semibold text-mt-ink">{user.name}</span>
            <button
              type="button"
              onClick={() => { session.userId = 0; setUser(null) }}
              className="rounded-full bg-[#EEF1F5] px-3 py-1 text-[13px] font-semibold text-muted transition hover:text-mt-ink"
            >
              Выйти
            </button>
          </>
        ) : (
          <span className="text-[13px] font-medium text-muted">Вход в Moby</span>
        )}
      </div>
      <div className="relative flex h-[calc(100dvh-52px)] w-full flex-col overflow-hidden bg-[#EDEFF3] sm:h-[min(820px,calc(100dvh-90px))] sm:max-w-[400px] sm:rounded-[36px] sm:border-[7px] sm:border-mt-ink sm:shadow-2xl">
        <ToastHost />
<<<<<<< HEAD
        <BonusBannerHost />
        <Phone key={uid} uid={uid} />
=======
        {user
          ? <Phone key={user.id} uid={user.id} />
          : <div className="flex-1 overflow-y-auto"><LoginScreen onSuccess={setUser} /></div>}
>>>>>>> feature/backCursor
      </div>
    </div>
  )
}
