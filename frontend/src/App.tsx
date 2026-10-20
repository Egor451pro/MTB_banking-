import { useEffect, useState } from 'react'
import { api, session, usingMock } from './api'
import { NavProvider, useNav } from './nav'
import { BottomNav, ToastHost, Loading, type TabDef } from './ui'
import { useData } from './hooks'
import type { Me } from './types'
import { ChildGoals, ChildHome, ChildLevel, ChildPay, ChildTasks, RequestScreen } from './screens/child'
import { ChildManage, PackageFlow, ParentHome, ParentRequests, ParentTasks } from './screens/parent'

const DEMO_USERS = [
  { id: 1, label: 'Мама' },
  { id: 2, label: 'Миша, 10' },
  { id: 3, label: 'Аня, 15' },
]

function ParentShell() {
  const { tab, setTab, stack } = useNav()
  const fam = useData(() => api.getFamily(), [], 3000)
  const pending = fam.data?.children.reduce((s, c) => s + c.pending_requests, 0) ?? 0
  const tabs: TabDef[] = [
    { id: 'home', label: 'Главная', icon: '🏠' },
    { id: 'requests', label: 'Запросы', icon: '🔔', badge: pending },
    { id: 'tasks', label: 'Задания', icon: '✅' },
  ]
  const top = stack[stack.length - 1]
  let body
  if (top?.name === 'child') body = <ChildManage key={top.params!.id} id={top.params!.id} />
  else if (top?.name === 'package') body = <PackageFlow />
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
  const { tab, setTab, stack } = useNav()
  const tabs: TabDef[] = [
    { id: 'home', label: 'Главная', icon: '🏠' },
    { id: 'pay', label: 'Оплата', icon: '💳' },
    { id: 'goals', label: 'Цели', icon: '🎯' },
    { id: 'tasks', label: 'Задания', icon: '✅' },
    { id: 'level', label: 'Уровень', icon: '🏆' },
  ]
  const top = stack[stack.length - 1]
  let body
  if (top?.name === 'request') body = <RequestScreen {...(top.params ?? {})} />
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
  useEffect(() => { session.userId = uid; api.getMe().then(setMe) }, [uid])
  if (!me) return <Loading />
  return (
    <NavProvider initialTab="home">
      {me.role === 'parent' ? <ParentShell /> : <ChildShell me={me} />}
    </NavProvider>
  )
}

export default function App() {
  const [uid, setUid] = useState(1)
  // session.userId выставляется до рендера дочерних экранов
  session.userId = uid
  return (
    <div className="flex min-h-screen flex-col items-center gap-3 px-2 py-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Демо-вход{usingMock ? ' (mock)' : ''}:</span>
        {DEMO_USERS.map((u) => (
          <button key={u.id} onClick={() => setUid(u.id)} className={`rounded-full px-3 py-1 ${uid === u.id ? 'bg-moby-600 text-white' : 'bg-white text-slate-600'}`}>{u.label}</button>
        ))}
      </div>
      <div className="relative flex h-[min(820px,calc(100vh-70px))] w-full max-w-[430px] flex-col overflow-hidden rounded-[28px] bg-bg shadow-2xl">
        <ToastHost />
        <Phone key={uid} uid={uid} />
      </div>
    </div>
  )
}
