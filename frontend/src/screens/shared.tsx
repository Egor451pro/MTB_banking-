import type { ReactNode } from 'react'
import { api } from '../api'
import { CATEGORY_ICON, DECLINE_TEXT, REQ_LABEL, CATEGORY_LABEL, dateTime, money } from '../format'
import { useData } from '../hooks'
import { Card, Chip, Empty, Loading, Progress } from '../ui'
import type { AccessRequest, Goal, Task, Transaction } from '../types'

export function TxRow({ t }: { t: Transaction }) {
  const declined = t.status === 'declined'
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-moby-50 text-lg">
        {t.direction === 'in' ? '⬇️' : t.category ? CATEGORY_ICON[t.category] : '💳'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{t.merchant}</div>
        <div className="text-xs text-slate-500">
          {dateTime(t.created_at)}
          {declined && t.decline_reason && <span className="text-red-500"> · {DECLINE_TEXT[t.decline_reason]}</span>}
          {t.status === 'pending' && <span className="text-amber-600"> · ждёт родителя</span>}
        </div>
      </div>
      <div className={`font-semibold ${declined ? 'text-slate-400 line-through' : t.direction === 'in' ? 'text-emerald-600' : ''}`}>
        {t.direction === 'in' ? '+' : '−'}{money(t.amount_cents)}
      </div>
    </div>
  )
}

export function TxList({ childId, limit = 8, poll = 0 }: { childId: number; limit?: number; poll?: number }) {
  const { data } = useData(() => api.getTransactions(childId, limit), [childId, limit], poll)
  if (!data) return <Loading />
  if (!data.items.length) return <Empty text="Операций пока нет" />
  return <div className="divide-y divide-slate-100">{data.items.map((t) => <TxRow key={t.id} t={t} />)}</div>
}

export function GoalCard({ g, children }: { g: Goal; children?: ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="font-semibold">🎯 {g.title}</div>
        {g.status === 'done' ? <Chip tone="green">Достигнута</Chip> : g.parent_bonus_percent > 0 && <Chip>бонус +{g.parent_bonus_percent}%</Chip>}
      </div>
      <div className="mt-2"><Progress value={g.saved_cents} max={g.target_cents} /></div>
      <div className="mt-1 text-sm text-slate-500">{money(g.saved_cents)} из {money(g.target_cents)}</div>
      {children && <div className="mt-3">{children}</div>}
    </Card>
  )
}

const TASK_CHIP: Record<Task['status'], { t: string; tone: 'blue' | 'green' | 'red' | 'gray' | 'amber' }> = {
  new: { t: 'Новое', tone: 'blue' },
  done: { t: 'Ждёт проверки', tone: 'amber' },
  confirmed: { t: 'Подтверждено', tone: 'green' },
  rejected: { t: 'Отклонено', tone: 'red' },
}

export function TaskHead({ t }: { t: Task }) {
  const c = TASK_CHIP[t.status]
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <div className="font-semibold">{t.title}</div>
        <div className="text-sm text-slate-500">+{money(t.reward_cents)} · +{t.xp_reward} XP</div>
      </div>
      <Chip tone={c.tone}>{c.t}</Chip>
    </div>
  )
}

export function requestText(r: AccessRequest): string {
  if (r.type === 'money') return `Деньги: ${money(r.amount_cents ?? 0)}`
  if (r.type === 'limit_increase') return `Дневной лимит до ${money(r.amount_cents ?? 0)}`
  return `${REQ_LABEL[r.type]}: ${r.category ? CATEGORY_LABEL[r.category] : ''}`
}
