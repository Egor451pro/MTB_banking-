import { useState, type ReactNode } from 'react'
import { api } from '../api'
import { CATEGORY_ICON, CATEGORY_LABEL, DECLINE_TEXT, PERMISSION_INFO, dateTime, money } from '../format'
import { useData } from '../hooks'
import { Icon } from '../icons'
import { Badge, Btn, Card, Empty, Header, IconTile, Loading, Progress, Section, Sheet, useGrow, type BadgeTone } from '../ui'
import type { AccessRequest, ChildDetail, Goal, Task, Transaction } from '../types'

export function TxRow({ t, who }: { t: Transaction; who?: string }) {
  const declined = t.status === 'declined'
  const pending = t.status === 'pending'
  const income = t.direction === 'in'
  const icon = income ? 'arrow-in' : t.category ? CATEGORY_ICON[t.category] : 'card'
  const what = income ? 'Пополнение' : t.category ? CATEGORY_LABEL[t.category] : 'Покупка'
  return (
    <div className="flex items-center gap-3 py-3">
      <IconTile name={icon} tone={declined ? 'red' : 'blue'} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-mt-ink">{t.merchant}</div>
        <div className="truncate text-[13px] text-muted">
          {who && <span className="font-medium text-mt-ink">{who} · </span>}
          {declined && t.decline_reason
            ? <span className="font-medium text-mt-red">{DECLINE_TEXT[t.decline_reason]}</span>
            : pending ? 'Ждёт подтверждения' : what}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={`text-[15px] font-semibold tabular-nums ${declined ? 'text-[#9AA6B8] line-through' : income ? 'text-[#2F6FE4]' : 'text-mt-ink'}`}>
          {income ? '+' : '−'}{money(t.amount_cents)}
        </div>
        <div className="text-xs tabular-nums text-muted">{dateTime(t.created_at)}</div>
      </div>
    </div>
  )
}

export function TxList({ childId, limit = 8, poll = 0 }: { childId: number; limit?: number; poll?: number }) {
  const { data } = useData(() => api.getTransactions(childId, limit), [childId, limit], poll)
  if (!data) return <Loading />
  if (!data.items.length) return <Empty text="Операций пока нет" icon="card" />
  return (
    <Card className="px-4 py-1">
      <div className="divide-y divide-line">{data.items.map((t) => <TxRow key={t.id} t={t} />)}</div>
    </Card>
  )
}

export function GoalCard({ g, children }: { g: Goal; children?: ReactNode }) {
  const pct = g.target_cents > 0 ? Math.min(100, Math.round((g.saved_cents / g.target_cents) * 100)) : 0
  const done = g.status === 'done'
  return (
    <Card>
      <div className="flex items-start gap-3">
        <IconTile name="target" tone={done ? 'solid' : 'blue'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-base font-semibold text-mt-ink">{g.title}</div>
            <div className="text-sm font-bold tabular-nums text-[#2F6FE4]">{pct}%</div>
          </div>
          <div className="mt-0.5 text-[13px] tabular-nums text-muted">{money(g.saved_cents)} из {money(g.target_cents)}</div>
        </div>
      </div>
      <div className="mt-3"><Progress value={g.saved_cents} max={g.target_cents} /></div>
      {(done || g.parent_bonus_percent > 0 || !!g.bonus_cents) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {done && <Badge tone="solid">Цель достигнута</Badge>}
          {g.parent_bonus_percent > 0 && <Badge tone="blue">Бонус родителя +{g.parent_bonus_percent}%</Badge>}
          {!!g.bonus_cents && <Badge tone="solid">Получено бонусов {money(g.bonus_cents)}</Badge>}
        </div>
      )}
      {children && <div className="mt-3 border-t border-line pt-3">{children}</div>}
    </Card>
  )
}

const TASK_BADGE: Record<Task['status'], { t: string; tone: BadgeTone }> = {
  new: { t: 'Новое', tone: 'blue' },
  done: { t: 'На проверке', tone: 'sky' },
  confirmed: { t: 'Выполнено', tone: 'solid' },
  rejected: { t: 'Не принято', tone: 'redsoft' },
}

export function TaskHead({ t, who }: { t: Task; who?: string }) {
  const b = TASK_BADGE[t.status]
  return (
    <div className="flex items-start gap-3">
      <IconTile name="tasks" tone={t.status === 'confirmed' ? 'solid' : 'blue'} />
      <div className="min-w-0 flex-1">
        {who && <div className="text-xs font-semibold uppercase tracking-wide text-muted">{who}</div>}
        <div className="text-[15px] font-semibold text-mt-ink">{t.title}</div>
        <div className="mt-0.5 text-[13px] tabular-nums text-muted">Награда {money(t.reward_cents)} · {t.xp_reward} XP</div>
      </div>
      <Badge tone={b.tone}>{b.t}</Badge>
    </div>
  )
}

// Короткая формулировка запроса для списков и карточек
export function requestText(r: AccessRequest): string {
  if (r.type === 'money') return `${money(r.amount_cents ?? 0)} на карту`
  if (r.type === 'limit_increase') return `Лимит ${money(r.amount_cents ?? 0)} в день`
  if (r.type === 'product_access') return `Доступ: «${r.permission ? PERMISSION_INFO[r.permission].title : ''}»`
  return `Открыть «${r.category ? CATEGORY_LABEL[r.category] : ''}»`
}

export const REQ_ICON = { money: 'wallet', limit_increase: 'arrow-up', category_unlock: 'unlock', product_access: 'shield' } as const

// Уровень показываем из GET /children/{id}: уровень — мотивация ребёнка, права меняет только родитель
export function LevelRing({ level }: { level: ChildDetail['level'] }) {
  const next = level.xp + level.xp_to_next
  const pct = useGrow(level.xp_to_next > 0 && next > 0 ? level.xp / next : 1)
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden="true">
      <defs>
        <linearGradient id="lvl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E42C26" />
          <stop offset="100%" stopColor="#FF5912" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r={r} fill="none" stroke="#E3EBF5" strokeWidth="10" />
      <circle
        cx="64" cy="64" r={r} fill="none" stroke="url(#lvl)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 64 64)"
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(.22,1,.36,1)' }}
      />
      <text x="64" y="62" textAnchor="middle" fontSize="40" fontWeight="800" fill="#141416">{level.level}</text>
      <text x="64" y="84" textAnchor="middle" fontSize="12" fontWeight="600" fill="#5E6878">уровень</text>
    </svg>
  )
}

// ───────── Бонусы и партнёры (общий экран для родителя и ребёнка) ─────────
export function LoyaltyScreen({ onBack }: { onBack?: () => void }) {
  const { data, reload } = useData(() => api.getLoyalty(), [])
  const [code, setCode] = useState<{ title: string; code: string } | null>(null)
  if (!data) return <><Header title="Бонусы" onBack={onBack} /><Loading /></>
  return (
    <>
      <Header title="Бонусы и партнёры" subtitle="1 балл = 1 копейка" onBack={onBack} tall />
      <div className="-mt-12 space-y-5 px-4 pb-6">
        <div className="flex items-center gap-4 rounded-[24px] bg-card p-5 shadow-[0_10px_30px_-18px_rgba(20,20,22,0.35)]">
          <IconTile name="coins" tone="solid" size={52} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[#A3ABB8]">Мои баллы</div>
            <div className="font-display text-[30px] font-bold tabular-nums tracking-tight text-mt-ink">{data.points.toLocaleString('ru-RU')}</div>
          </div>
        </div>

        <Section title="Кешбэк баллами">
          <div className="grid grid-cols-2 gap-2">
            {data.cashback.map((c) => (
              <div key={c.category} className="flex items-center gap-3 rounded-[20px] bg-card p-3.5">
                <Icon name={CATEGORY_ICON[c.category]} size={26} strokeWidth={1.6} className="text-[#2F6FE4]" />
                <div>
                  <div className="text-sm font-semibold text-mt-ink">{CATEGORY_LABEL[c.category]}</div>
                  <div className="text-xs text-muted">{c.percent}% баллами</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Предложения партнёров">
          {!data.offers.length
            ? <Empty text="Предложения партнёров выключены родителем" icon="gift" />
            : (
              <Card className="divide-y divide-line p-0">
                {data.offers.map((o) => {
                  const enough = data.points >= o.points_cost
                  return (
                    <div key={o.id} className="flex items-center gap-3 px-4 py-3.5">
                      <IconTile name="gift" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#A3ABB8]">{o.partner}</div>
                        <div className="text-[15px] font-semibold text-mt-ink">{o.title}</div>
                        <div className="text-[13px] text-muted">{o.description}</div>
                      </div>
                      <Btn small full={false} tone={enough ? 'secondary' : 'ghost'} disabled={!enough} onClick={async () => {
                        const r = await api.redeemOffer(o.id)
                        setCode({ title: o.title, code: r.code })
                        await reload()
                      }}>{o.points_cost} б.</Btn>
                    </div>
                  )
                })}
              </Card>
            )}
        </Section>
      </div>

      <Sheet open={!!code} onClose={() => setCode(null)} title="Промокод получен">
        {code && (
          <div className="space-y-4 text-center">
            <div className="text-[15px] text-muted">{code.title}</div>
            <div className="rounded-2xl bg-elevated py-5 font-display text-3xl font-bold tracking-[0.15em] text-mt-ink">{code.code}</div>
            <div className="text-sm text-muted">Покажите код у партнёра</div>
            <Btn onClick={() => setCode(null)}>Готово</Btn>
          </div>
        )}
      </Sheet>
    </>
  )
}
