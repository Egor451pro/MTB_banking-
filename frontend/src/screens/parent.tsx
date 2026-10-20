import { useEffect, useState } from 'react'
import { api } from '../api'
import { CATEGORY_ICON, CATEGORY_LABEL, ageFrom, dateTime, money, toCents } from '../format'
import { useData } from '../hooks'
import { useNav } from '../nav'
import {
  BalanceCard, Btn, Card, Chip, Empty, Field, Header, Loading, Progress, Section, Sheet, Toggle, toast,
} from '../ui'
import type { Category, ConsentType, LimitItem } from '../types'
import { GoalCard, TaskHead, TxList, requestText } from './shared'

const CATS: Category[] = ['food', 'transport', 'games', 'subscriptions', 'shopping', 'entertainment', 'education', 'adult18']

// ───────── Главная родителя: дети и срочное ─────────
export function ParentHome() {
  const { push } = useNav()
  const { data, reload } = useData(() => api.getFamily(), [], 3000)
  if (!data) return <Loading />
  const pending = data.children.reduce((s, c) => s + c.pending_requests, 0)
  return (
    <>
      <Header title={data.family.name} right={<Chip tone="gray">Родитель</Chip>} />
      <div className="space-y-4 p-4">
        {pending > 0 && (
          <Card className="border border-amber-200 bg-amber-50">
            <div className="font-semibold text-amber-800">Новых запросов: {pending}</div>
            <div className="text-sm text-amber-700">Дети ждут вашего решения во вкладке «Запросы»</div>
          </Card>
        )}
        <Section title="Дети">
          {data.children.map((c) => (
            <div key={c.id} className="space-y-2" onClick={() => push({ name: 'child', params: { id: c.id } })}>
              <div className="flex items-center justify-between px-1">
                <div className="font-semibold">{c.name} <span className="font-normal text-slate-500">· {c.age_group} лет</span></div>
                <div className="flex gap-1">
                  <Chip>ур. {c.level}</Chip>
                  {c.pending_requests > 0 && <Chip tone="amber">запросов: {c.pending_requests}</Chip>}
                </div>
              </div>
              <BalanceCard card={c.card} title={`Карта ${c.name}`} sub="Нажмите, чтобы управлять" />
            </div>
          ))}
        </Section>
        <Btn onClick={() => push({ name: 'package' })}>＋ Оформить пакет для ребёнка</Btn>
        <button onClick={async () => { await api.demoReset(); await reload(); toast('Демо-данные сброшены') }} className="w-full py-2 text-xs text-slate-400">
          Сбросить демо-данные
        </button>
      </div>
    </>
  )
}

// ───────── Оформление пакета: возраст → состав → согласия → выпуск ─────────
export function PackageFlow() {
  const { back, push } = useNav()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('2014-05-15')
  const [consents, setConsents] = useState<ConsentType[]>([])
  const age = ageFrom(birth)
  const group = age >= 14 ? '14–17' : '7–13'
  const valid = name.trim().length > 0 && age >= 7 && age <= 17

  const toggle = (c: ConsentType) => setConsents((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]))
  const need: ConsentType[] = ['card_issue', 'moby_access']
  const okConsents = need.every((c) => consents.includes(c))

  const items: { id: ConsentType; title: string; text: string; req: boolean }[] = [
    { id: 'card_issue', title: 'Выпуск детской карты', text: 'Я законный представитель и согласен(на) на выпуск карты ребёнку', req: true },
    { id: 'moby_access', title: 'Доступ ребёнка в Moby', text: 'Ребёнок получит свой вход с ограниченными правами', req: true },
    ...(age >= 14 ? [{ id: 'online_payments' as ConsentType, title: 'Онлайн-платежи', text: 'Разрешить онлайн-покупки (крупные — с вашим подтверждением)', req: false }] : []),
  ]

  return (
    <>
      <Header title="Семейный пакет" onBack={back} />
      <div className="space-y-4 p-4">
        <div className="flex gap-1">{[0, 1, 2].map((i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-moby-600' : 'bg-slate-200'}`} />)}</div>

        {step === 0 && (
          <>
            <Field label="Имя ребёнка" value={name} onChange={setName} placeholder="Например, Саша" />
            <Field label="Дата рождения" type="date" value={birth} onChange={setBirth} />
            {age < 7 || age > 17
              ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">Пакет выпускается детям от 7 до 17 лет</div>
              : <div className="rounded-xl bg-moby-50 px-3 py-2 text-sm text-moby-700">Возраст {age} → пакет «{group} лет»</div>}
            <Btn disabled={!valid} onClick={() => setStep(1)}>Далее</Btn>
          </>
        )}

        {step === 1 && (
          <>
            <Card>
              <div className="mb-2 font-semibold">Что входит в пакет «{group}»</div>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>💳 Детская карта с лимитами и запретом категорий</li>
                <li>📱 Свой вход в Moby с правами по возрасту</li>
                <li>🎯 Цели накоплений и бонус от родителя</li>
                <li>🏆 Уровни доверия: права растут вместе с ребёнком</li>
                {age >= 14 ? <li>🌐 Онлайн-платежи с подтверждением крупных покупок</li> : <li>🛡️ Только офлайн-покупки, пока ребёнок не вырастет</li>}
                <li>🎓 Переход на взрослый тариф в 18 лет</li>
              </ul>
            </Card>
            <Btn onClick={() => setStep(2)}>Далее</Btn>
          </>
        )}

        {step === 2 && (
          <>
            {items.map((i) => (
              <Card key={i.id}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="font-semibold">{i.title} {i.req && <span className="text-red-500">*</span>}</div>
                    <div className="text-sm text-slate-500">{i.text}</div>
                  </div>
                  <Toggle on={consents.includes(i.id)} onChange={() => toggle(i.id)} />
                </div>
              </Card>
            ))}
            <Btn disabled={!okConsents} onClick={async () => {
              const r = await api.createPackage({ child_name: name, child_birth_date: birth, consents })
              toast('Карта выпущена')
              back()
              push({ name: 'child', params: { id: r.child_id } })
            }}>Выпустить карту</Btn>
          </>
        )}
      </div>
    </>
  )
}

// ───────── Управление ребёнком ─────────
export function ChildManage({ id }: { id: number }) {
  const { back } = useNav()
  const { data: c, reload } = useData(() => api.getChild(id), [id], 3000)
  const [topup, setTopup] = useState(false)
  const [amount, setAmount] = useState('')
  const [txKey, setTxKey] = useState(0)
  if (!c) return <><Header title="Ребёнок" onBack={back} /><Loading /></>
  const blocked = c.card.status === 'blocked'
  const lim = c.limits_today
  return (
    <>
      <Header title={c.name} onBack={back} right={<Chip tone="gray">{c.age_group} лет</Chip>} />
      <div className="space-y-4 p-4">
        <BalanceCard card={c.card} title={`Карта ${c.name}`} sub={lim.limit_cents != null ? `Сегодня осталось ${money(lim.left_cents ?? 0)}` : 'Без дневного лимита'} />
        <div className="flex gap-2">
          <Btn small onClick={() => setTopup(true)}>Пополнить</Btn>
          <Btn small tone={blocked ? 'ok' : 'danger'} onClick={async () => {
            blocked ? await api.unblockCard(c.card.id) : await api.blockCard(c.card.id)
            await reload()
          }}>{blocked ? 'Разблокировать' : 'Заблокировать'}</Btn>
        </div>

        <LimitsEditor childId={id} onSaved={reload} />

        <Section title="Операции">
          <Card><TxList key={txKey + c.card.balance_cents} childId={id} limit={8} /></Card>
        </Section>

        <GoalsParent childId={id} />
        <LevelParent childId={id} onChanged={reload} />
      </div>

      <Sheet open={topup} onClose={() => setTopup(false)} title={`Пополнить карту ${c.name}`}>
        <div className="space-y-3">
          <Field label="Сумма, BYN" inputMode="decimal" value={amount} onChange={setAmount} placeholder="10" />
          <div className="flex gap-2">
            {[5, 10, 20].map((v) => <Btn key={v} small tone="ghost" onClick={() => setAmount(String(v))}>{v}</Btn>)}
          </div>
          <Btn onClick={async () => {
            const cents = toCents(amount)
            if (!(cents > 0)) { toast('Введите сумму больше нуля'); return }
            await api.topup(id, cents)
            setTopup(false); setAmount(''); setTxKey((k) => k + 1)
            await reload()
            toast('Карта пополнена')
          }}>Пополнить</Btn>
        </div>
      </Sheet>
    </>
  )
}

function LimitsEditor({ childId, onSaved }: { childId: number; onSaved: () => void }) {
  const { data, reload } = useData(() => api.getLimits(childId), [childId])
  const [daily, setDaily] = useState('')
  const [blockedSet, setBlockedSet] = useState<Set<Category>>(new Set())
  const [catLimits, setCatLimits] = useState<LimitItem[]>([])

  // Подтягиваем состояние формы из загруженных лимитов
  useEffect(() => {
    if (!data) return
    const g = data.items.find((l) => l.category === null && l.period === 'day')
    setDaily(g ? String(g.amount_cents / 100) : '')
    setBlockedSet(new Set(data.items.filter((l) => l.category && l.is_blocked).map((l) => l.category as Category)))
    setCatLimits(data.items.filter((l) => l.category && !l.is_blocked))
  }, [data])

  if (!data) return <Loading />

  async function save() {
    const items: LimitItem[] = []
    const cents = toCents(daily)
    if (daily.trim() !== '' && !(cents >= 0)) { toast('Лимит должен быть числом'); return }
    if (daily.trim() !== '') items.push({ category: null, period: 'day', amount_cents: cents, is_blocked: false })
    items.push(...catLimits)
    blockedSet.forEach((cat) => items.push({ category: cat, period: 'day', amount_cents: 0, is_blocked: true }))
    await api.putLimits(childId, items)
    await reload(); onSaved()
    toast('Лимиты сохранены')
  }

  return (
    <Section title="Лимиты и категории">
      <Card className="space-y-3">
        <Field label="Дневной лимит, BYN (пусто — без лимита)" inputMode="decimal" value={daily} onChange={setDaily} placeholder="10" />
        <div className="divide-y divide-slate-100">
          {CATS.map((cat) => {
            const locked = cat === 'adult18'
            const allowed = locked ? false : !blockedSet.has(cat)
            return (
              <div key={cat} className="flex items-center gap-3 py-2.5">
                <span className="text-xl">{CATEGORY_ICON[cat]}</span>
                <div className="flex-1">
                  <div>{CATEGORY_LABEL[cat]}</div>
                  {locked && <div className="text-xs text-slate-400">Запрещено банком, изменить нельзя</div>}
                </div>
                <Toggle on={allowed} disabled={locked} onChange={(v) => setBlockedSet((s) => { const n = new Set(s); v ? n.delete(cat) : n.add(cat); return n })} />
              </div>
            )
          })}
        </div>
        <Btn onClick={save}>Сохранить</Btn>
      </Card>
    </Section>
  )
}

function GoalsParent({ childId }: { childId: number }) {
  const { data, reload } = useData(() => api.getGoals(childId), [childId], 3000)
  if (!data || !data.items.length) return null
  return (
    <Section title="Цели ребёнка">
      {data.items.map((g) => (
        <GoalCard key={g.id} g={g}>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Бонус от вас:</span>
            {[0, 10, 20].map((p) => (
              <button key={p} onClick={async () => { await api.setGoalBonus(g.id, p); await reload() }}
                className={`rounded-full px-3 py-1 ${g.parent_bonus_percent === p ? 'bg-moby-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {p === 0 ? 'нет' : `+${p}%`}
              </button>
            ))}
          </div>
        </GoalCard>
      ))}
    </Section>
  )
}

function LevelParent({ childId, onChanged }: { childId: number; onChanged: () => void }) {
  const { data, reload } = useData(() => api.getLevel(childId), [childId], 3000)
  if (!data) return null
  const total = data.xp + data.xp_to_next
  return (
    <Section title="Уровень доверия">
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold">🏆 Уровень {data.level}</div>
          <div className="text-sm text-slate-500">{data.xp} XP</div>
        </div>
        {data.xp_to_next > 0 && <><Progress value={data.xp} max={total} /><div className="text-xs text-slate-500">До следующего уровня: {data.xp_to_next} XP</div></>}
        {data.suggestion && (
          <div className="mt-2 rounded-xl bg-moby-50 p-3">
            <div className="text-sm font-medium text-moby-900">💡 {data.suggestion.text}</div>
            <div className="mt-2">
              <Btn small onClick={async () => { await api.acceptSuggestion(childId); await reload(); onChanged(); toast('Права расширены') }}>Разрешить</Btn>
            </div>
          </div>
        )}
      </Card>
    </Section>
  )
}

// ───────── Запросы ─────────
export function ParentRequests() {
  const { data, reload } = useData(() => api.listRequests(), [], 3000)
  if (!data) return <Loading />
  const pending = data.items.filter((r) => r.status === 'pending')
  const done = data.items.filter((r) => r.status !== 'pending')
  return (
    <>
      <Header title="Запросы" />
      <div className="space-y-4 p-4">
        <Section title="Ждут решения">
          {!pending.length && <Empty text="Новых запросов нет" />}
          {pending.map((r) => (
            <Card key={r.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.child_name}</div>
                <div className="text-xs text-slate-400">{dateTime(r.created_at)}</div>
              </div>
              <div>{requestText(r)}</div>
              {r.comment && <div className="text-sm text-slate-500">«{r.comment}»</div>}
              <div className="flex gap-2">
                <Btn small tone="ok" onClick={async () => { await api.approveRequest(r.id); await reload(); toast('Одобрено') }}>Одобрить</Btn>
                <Btn small tone="danger" onClick={async () => { await api.rejectRequest(r.id); await reload() }}>Отклонить</Btn>
              </div>
            </Card>
          ))}
        </Section>
        {done.length > 0 && (
          <Section title="История">
            {done.map((r) => (
              <Card key={r.id} className="flex items-center justify-between">
                <div><div className="font-medium">{r.child_name}</div><div className="text-sm text-slate-500">{requestText(r)}</div></div>
                <Chip tone={r.status === 'approved' ? 'green' : 'red'}>{r.status === 'approved' ? 'Одобрено' : 'Отклонено'}</Chip>
              </Card>
            ))}
          </Section>
        )}
      </div>
    </>
  )
}

// ───────── Задания ─────────
export function ParentTasks() {
  const fam = useData(() => api.getFamily(), [])
  const { data, reload } = useData(() => api.listTasks(), [], 3000)
  const [open, setOpen] = useState(false)
  const [child, setChild] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [reward, setReward] = useState('2')
  const [xp, setXp] = useState('20')
  const kids = fam.data?.children ?? []
  const nameOf = (id: number) => kids.find((k) => k.id === id)?.name ?? ''

  if (!data) return <Loading />
  const order = { done: 0, new: 1, rejected: 2, confirmed: 3 } as const
  const items = [...data.items].sort((a, b) => order[a.status] - order[b.status])
  return (
    <>
      <Header title="Задания" />
      <div className="space-y-3 p-4">
        <Btn onClick={() => { setChild(kids[0]?.id ?? null); setOpen(true) }}>＋ Новое задание</Btn>
        {!items.length && <Empty text="Заданий пока нет" />}
        {items.map((t) => (
          <Card key={t.id} className="space-y-2">
            <div className="text-xs text-slate-400">{nameOf(t.assigned_to)}</div>
            <TaskHead t={t} />
            {t.status === 'done' && (
              <div className="flex gap-2">
                <Btn small tone="ok" onClick={async () => { await api.taskConfirm(t.id); await reload(); toast('Награда выплачена') }}>Подтвердить</Btn>
                <Btn small tone="danger" onClick={async () => { await api.taskReject(t.id); await reload() }}>Не выполнено</Btn>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Новое задание">
        <div className="space-y-3">
          <div className="flex gap-2">
            {kids.map((k) => (
              <button key={k.id} onClick={() => setChild(k.id)} className={`rounded-full px-4 py-2 text-sm ${child === k.id ? 'bg-moby-600 text-white' : 'bg-slate-100'}`}>{k.name}</button>
            ))}
          </div>
          <Field label="Что сделать" value={title} onChange={setTitle} placeholder="Помыть посуду" />
          <Field label="Награда, BYN" inputMode="decimal" value={reward} onChange={setReward} />
          <Field label="Опыт (XP)" inputMode="numeric" value={xp} onChange={setXp} />
          <Btn onClick={async () => {
            const r = toCents(reward)
            const x = Number(xp)
            if (child == null || !title.trim() || !(r >= 0) || !(x >= 0)) { toast('Заполните все поля'); return }
            await api.createTask({ assigned_to: child, title, reward_cents: r, xp_reward: Math.round(x) })
            setOpen(false); setTitle(''); await reload()
          }}>Создать</Btn>
        </div>
      </Sheet>
    </>
  )
}
