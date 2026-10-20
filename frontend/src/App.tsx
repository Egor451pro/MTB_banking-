import { useEffect, useState } from 'react'
import { api, session, usingMock } from './api'
import { NavProvider, useNav } from './nav'
import { BottomNav, ToastHost, Loading, type TabDef } from './ui'
import { useData } from './hooks'
import type { Me } from './types'
import { ChildGoals, ChildHome, ChildLevel, ChildPay, ChildTasks, LessonScreen, RequestScreen } from './screens/child'
import { LoyaltyScreen } from './screens/shared'
import { ChildManage, PackageFlow, ParentHome, ParentProducts, ParentRequests, ParentTasks } from './screens/parent'

const DEMO_USERS = [
  { id: 1, label: 'Мама' },
  { id: 2, label: 'Миша, 10' },
  { id: 3, label: 'Аня, 15' },
]

function ParentShell() {
  const { tab, setTab, stack, back } = useNav()
  const fam = useData(() => api.getFamily(), [], 3000)
  const pp = useData(() => api.listPendingPurchases(), [], 3000)
  const pending = (fam.data?.children.reduce((s, c) => s + c.pending_requests, 0) ?? 0) + (pp.data?.items.length ?? 0)
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
      <div className="flex-1 overflow-y-auto">{body}</div>
      <BottomNav tabs={tabs} active={tab} onChange={setTab} />
    </>
  )
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
      <div className="flex-1 overflow-y-auto">{body}</div>
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
  const [uid, setUid] = useState(1)
  // session.userId выставляется до рендера экранов, чтобы первый запрос ушёл от нужного пользователя
  session.userId = uid
  return (
    <div className="flex min-h-[100dvh] flex-col items-center sm:gap-4 sm:py-5">
      <div className="flex w-full items-center justify-center gap-2 bg-white px-3 py-2 sm:w-auto sm:rounded-full sm:py-1.5 sm:pl-4 sm:shadow-sm">
        <span className="text-xs font-semibold text-muted">Демо{usingMock ? ' · mock' : ''}</span>
        <div className="flex rounded-full bg-[#EEF1F5] p-0.5">
          {DEMO_USERS.map((u) => (
            <button
              key={u.id} onClick={() => setUid(u.id)}
              className={`rounded-full px-3 py-1 text-[13px] font-semibold transition ${uid === u.id ? 'bg-mt-blue text-white' : 'text-muted'}`}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative flex h-[calc(100dvh-44px)] w-full flex-col overflow-hidden bg-[#EDEFF3] sm:h-[min(820px,calc(100dvh-90px))] sm:max-w-[400px] sm:rounded-[36px] sm:border-[7px] sm:border-mt-ink sm:shadow-2xl">
        <ToastHost />
        <Phone key={uid} uid={uid} />
      </div>
    </div>
  )
}
