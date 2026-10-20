import { useEffect, useState } from 'react'
import { api } from '../api'
import { CATEGORY_ICON, CATEGORY_LABEL, REQ_SHORT, ageFrom, ageLabel, dateTime, money, plural, toCents } from '../format'
import { useData } from '../hooks'
import { Icon, type IconName } from '../icons'
import { useNav } from '../nav'
import {
  Avatar, BalanceCard, Badge, Btn, Card, Empty, Field, Header, IconTile, Loading, Note, Progress,
  Row, Section, Segmented, Sheet, Toggle, toast,
} from '../ui'
import type { Category, ChildDetail, ConsentType, LimitItem } from '../types'
import { GoalCard, REQ_ICON, TaskHead, TxList, requestText } from './shared'

const CATS: Category[] = ['food', 'transport', 'education', 'shopping', 'entertainment', 'games', 'subscriptions', 'adult18']

// ───────── Главная родителя ─────────
export function ParentHome() {
  const { push, setTab } = useNav()
  const { data, reload } = useData(() => api.getFamily(), [], 3000)
  if (!data) return <><Header title="Семья" /><Loading /></>
  const pending = data.children.reduce((s, c) => s + c.pending_requests, 0)
  const total = data.children.reduce((s, c) => s + c.card.balance_cents, 0)
  return (
    <>
      <Header title={data.family.name} subtitle="Семейный банкинг" right={<Avatar name="Мама" light size={38} />} />
      <div className="space-y-5 p-4">
        {pending > 0 && (
          <Card onClick={() => setTab('requests')} className="flex items-center gap-3">
            <IconTile name="bell" tone="red" />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-mt-ink">{pending} {plural(pending, 'запрос', 'запроса', 'запросов')} от детей</div>
              <div className="text-[13px] text-muted">Ждут вашего решения</div>
            </div>
            <Icon name="chevron-right" size={20} className="text-[#9AA6B8]" />
          </Card>
        )}

        <Section title="Дети" action={<span className="text-sm tabular-nums text-muted">на картах {money(total)}</span>}>
          {data.children.map((c) => (
            <Card key={c.id} onClick={() => push({ name: 'child', params: { id: c.id } })}>
              <div className="flex items-center gap-3">
                <Avatar name={c.name} />
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-mt-ink">{c.name}</div>
                  <div className="text-[13px] text-muted">{ageLabel(c.age_group)}</div>
                </div>
                <div className="text-right">
                  <div className={`text-[17px] font-bold tabular-nums ${c.card.status === 'blocked' ? 'text-[#9AA6B8]' : 'text-mt-ink'}`}>{money(c.card.balance_cents)}</div>
                  <div className="text-xs tabular-nums text-muted">карта •• {c.card.last4}</div>
                </div>
                <Icon name="chevron-right" size={20} className="text-[#9AA6B8]" />
              </div>
              {(c.card.status === 'blocked' || c.pending_requests > 0) && (
                <div className="mt-3 flex flex-wrap gap-2 pl-[52px]">
                  {c.card.status === 'blocked' && <Badge tone="red"><Icon name="lock" size={14} />Карта заблокирована</Badge>}
                  {c.pending_requests > 0 && <Badge tone="redsoft">Запросов: {c.pending_requests}</Badge>}
                </div>
              )}
            </Card>
          ))}
        </Section>

        <div className="rounded-2xl bg-mt-blue p-5 text-white">
          <div className="text-lg font-bold leading-snug tracking-tight">Детская карта от 7 лет</div>
          <p className="mt-1 text-sm text-white/80">Лимиты, категории и цели — под вашим контролем. Ребёнок получает свой вход в Moby.</p>
          <div className="mt-4"><Btn tone="accent" icon="plus" onClick={() => push({ name: 'package' })}>Оформить пакет</Btn></div>
        </div>

        <button onClick={async () => { await api.demoReset(); await reload(); toast('Демо-данные сброшены') }} className="mx-auto flex items-center gap-1.5 py-2 text-xs font-medium text-muted">
          <Icon name="refresh" size={14} />Сбросить демо-данные
        </button>
      </div>
    </>
  )
}

// ───────── Оформление пакета ─────────
export function PackageFlow() {
  const { back, push } = useNav()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('2014-05-15')
  const [consents, setConsents] = useState<ConsentType[]>([])
  const age = ageFrom(birth)
  const teen = age >= 14
  const group = teen ? '14–17' : '7–13'
  const ageOk = age >= 7 && age <= 17
  const valid = name.trim().length > 0 && ageOk

  const toggle = (c: ConsentType) => setConsents((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]))
  const okConsents = (['card_issue', 'moby_access'] as ConsentType[]).every((c) => consents.includes(c))

  const features: { icon: IconName; title: string; text: string }[] = [
    { icon: 'card', title: 'Детская карта', text: 'Дневной лимит и запрет категорий' },
    { icon: 'phone', title: 'Свой вход в Moby', text: 'Права зависят от возраста' },
    { icon: 'target', title: 'Цели и копилки', text: 'Можно добавлять бонус к накоплениям' },
    { icon: 'tasks', title: 'Задания с наградой', text: 'Ребёнок зарабатывает на поручениях' },
    teen
      ? { icon: 'globe', title: 'Онлайн-покупки', text: 'Крупные — только с вашим подтверждением' }
      : { icon: 'shield', title: 'Только офлайн-покупки', text: 'Онлайн откроется с 14 лет' },
    { icon: 'arrow-up', title: 'В 18 лет — взрослая карта', text: 'Без смены банка, история сохраняется' },
  ]

  const consentItems: { id: ConsentType; title: string; text: string; req: boolean }[] = [
    { id: 'card_issue', title: 'Выпуск детской карты', text: 'Я законный представитель и согласен(на) на выпуск карты', req: true },
    { id: 'moby_access', title: 'Доступ ребёнка в Moby', text: 'Свой вход с ограниченными правами', req: true },
    ...(teen ? [{ id: 'online_payments' as ConsentType, title: 'Онлайн-платежи', text: 'Крупные покупки — с вашим подтверждением', req: false }] : []),
  ]

  return (
    <>
      <Header title="Детский пакет" subtitle={`Шаг ${step + 1} из 3`} onBack={step > 0 ? () => setStep(step - 1) : back} />
      <div className="space-y-4 p-4">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-mt-blue' : 'bg-[#C9D5E3]'}`} />)}
        </div>

        {step === 0 && (
          <>
            <h2 className="text-xl font-bold tracking-tight text-mt-ink">Для кого оформляем?</h2>
            <Card className="space-y-4">
              <Field label="Имя ребёнка" value={name} onChange={setName} placeholder="Например, Саша" />
              <Field label="Дата рождения" type="date" value={birth} onChange={setBirth} />
            </Card>
            {ageOk
              ? <Note icon="shield">Возраст {age} — тариф «{group} лет»</Note>
              : <Note tone="red" icon="ban">Пакет оформляется детям от 7 до 17 лет</Note>}
            <Btn disabled={!valid} onClick={() => setStep(1)}>Продолжить</Btn>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-xl font-bold tracking-tight text-mt-ink">Что входит в пакет «{group} лет»</h2>
            <Card className="divide-y divide-line p-0">
              {features.map((f) => <Row key={f.title} icon={f.icon} title={f.title} sub={f.text} />)}
            </Card>
            <Btn onClick={() => setStep(2)}>Продолжить</Btn>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-bold tracking-tight text-mt-ink">Согласия</h2>
            <Card className="divide-y divide-line p-0">
              {consentItems.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold text-mt-ink">{i.title}{i.req && <span className="text-mt-red"> *</span>}</div>
                    <div className="text-[13px] text-muted">{i.text}</div>
                  </div>
                  <Toggle on={consents.includes(i.id)} onChange={() => toggle(i.id)} />
                </div>
              ))}
            </Card>
            <p className="px-1 text-xs text-muted"><span className="text-mt-red">*</span> обязательные согласия</p>
            <Btn tone="accent" disabled={!okConsents} onClick={async () => {
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
type Pane = 'limits' | 'ops' | 'goals'

export function ChildManage({ id }: { id: number }) {
  const { back } = useNav()
  const { data: c, reload } = useData(() => api.getChild(id), [id], 3000)
  const [pane, setPane] = useState<Pane>('limits')
  const [topup, setTopup] = useState(false)
  const [amount, setAmount] = useState('')
  const [txKey, setTxKey] = useState(0)
  if (!c) return <><Header title="Ребёнок" onBack={back} /><Loading /></>
  const blocked = c.card.status === 'blocked'
  return (
    <>
      <Header title={c.name} subtitle={`${ageLabel(c.age_group)} · уровень ${c.level.level}`} onBack={back} tall />
      <div className="-mt-12 space-y-4 px-4 pb-6">
        <BalanceCard card={c.card} title="Детская карта" limit={c.limits_today} />
        <div className="grid grid-cols-2 gap-2">
          <Btn icon="wallet" onClick={() => setTopup(true)}>Пополнить</Btn>
          <Btn tone="danger" icon={blocked ? 'unlock' : 'lock'} onClick={async () => {
            if (blocked) await api.unblockCard(c.card.id)
            else await api.blockCard(c.card.id)
            await reload()
            toast(blocked ? 'Карта разблокирована' : 'Карта заблокирована')
          }}>{blocked ? 'Разблокировать' : 'Заблокировать'}</Btn>
        </div>

        <Segmented<Pane>
          options={[{ id: 'limits', label: 'Лимиты' }, { id: 'ops', label: 'Операции' }, { id: 'goals', label: 'Цели' }]}
          value={pane} onChange={setPane}
        />

        {pane === 'limits' && <LimitsEditor childId={id} onSaved={reload} />}
        {pane === 'ops' && <TxList key={txKey + c.card.balance_cents} childId={id} limit={15} />}
        {pane === 'goals' && <><LevelCard level={c.level} /><GoalsParent childId={id} /></>}
      </div>

      <Sheet open={topup} onClose={() => setTopup(false)} title={`Пополнить карту ${c.name}`}>
        <div className="space-y-4">
          <Field label="Сумма" inputMode="decimal" value={amount} onChange={setAmount} placeholder="0" suffix="BYN" />
          <div className="flex gap-2">
            {[5, 10, 20, 50].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} className="h-9 flex-1 rounded-[10px] bg-mt-cloud text-sm font-semibold text-mt-blue">{v} BYN</button>
            ))}
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

  // Заполняем форму из загруженных лимитов
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
    <div className="space-y-3">
      <Card>
        <Field label="Дневной лимит (пусто — без лимита)" inputMode="decimal" value={daily} onChange={setDaily} placeholder="Без лимита" suffix="BYN" />
      </Card>
      <Card className="divide-y divide-line p-0">
        {CATS.map((cat) => {
          const locked = cat === 'adult18'
          const allowed = !locked && !blockedSet.has(cat)
          return (
            <div key={cat} className="flex items-center gap-3 px-4 py-3">
              <IconTile name={CATEGORY_ICON[cat]} tone={allowed ? 'blue' : locked ? 'red' : 'gray'} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-mt-ink">{CATEGORY_LABEL[cat]}</div>
                <div className={`text-[13px] ${locked ? 'text-mt-red' : 'text-muted'}`}>
                  {locked ? 'Запрещено банком' : allowed ? 'Разрешено' : 'Запрещено вами'}
                </div>
              </div>
              {locked
                ? <Icon name="lock" size={20} className="mr-3 text-[#9AA6B8]" />
                : <Toggle on={allowed} onChange={(v) => setBlockedSet((s) => { const n = new Set(s); if (v) n.delete(cat); else n.add(cat); return n })} />}
            </div>
          )
        })}
      </Card>
      <Btn onClick={save}>Сохранить лимиты</Btn>
    </div>
  )
}

function LevelCard({ level }: { level: ChildDetail['level'] }) {
  const next = level.xp + level.xp_to_next
  return (
    <Card>
      <div className="flex items-center gap-3">
        <IconTile name="star" tone="solid" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-mt-ink">Уровень {level.level}</div>
          <div className="text-[13px] tabular-nums text-muted">
            {level.xp} XP{level.xp_to_next > 0 ? ` · до следующего ${level.xp_to_next}` : ' · максимальный'}
          </div>
        </div>
      </div>
      {level.xp_to_next > 0 && <div className="mt-3"><Progress value={level.xp} max={next} tone="brand" /></div>}
      <p className="mt-3 text-[13px] text-muted">Опыт начисляется за выполненные задания. Уровень мотивирует ребёнка, а лимиты и разрешения меняете только вы.</p>
    </Card>
  )
}

function GoalsParent({ childId }: { childId: number }) {
  const { data, reload } = useData(() => api.getGoals(childId), [childId], 3000)
  if (!data) return <Loading />
  if (!data.items.length) return <Empty text="Ребёнок пока не поставил цель" icon="target" />
  return (
    <>
      {data.items.map((g) => (
        <GoalCard key={g.id} g={g}>
          <div className="mb-2 text-[13px] font-medium text-muted">Ваш бонус к накоплениям</div>
          <Segmented<number>
            options={[{ id: 0, label: 'Нет' }, { id: 5, label: '+5%' }, { id: 10, label: '+10%' }, { id: 20, label: '+20%' }]}
            value={g.parent_bonus_percent}
            onChange={async (p) => { await api.setGoalBonus(g.id, p); await reload() }}
          />
        </GoalCard>
      ))}
    </>
  )
}

// ───────── Запросы ─────────
export function ParentRequests() {
  const { data, reload } = useData(() => api.listRequests(), [], 3000)
  if (!data) return <><Header title="Запросы" /><Loading /></>
  const pending = data.items.filter((r) => r.status === 'pending')
  const done = data.items.filter((r) => r.status !== 'pending')
  return (
    <>
      <Header title="Запросы" subtitle={pending.length ? `${pending.length} ${plural(pending.length, 'ждёт', 'ждут', 'ждут')} решения` : 'Всё рассмотрено'} />
      <div className="space-y-5 p-4">
        {!pending.length && <Empty text="Новых запросов нет" />}
        {pending.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center gap-3">
              <Avatar name={r.child_name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-mt-ink">{r.child_name}</div>
                <div className="text-xs text-muted">{dateTime(r.created_at)}</div>
              </div>
              <Badge tone="sky"><Icon name={REQ_ICON[r.type]} size={14} />{REQ_SHORT[r.type]}</Badge>
            </div>
            <div className="mt-3 text-xl font-bold tracking-tight text-mt-ink">{requestText(r)}</div>
            {r.comment && <div className="mt-2 rounded-xl bg-mt-cloud px-3 py-2.5 text-sm text-mt-ink">«{r.comment}»</div>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Btn small tone="danger" onClick={async () => { await api.rejectRequest(r.id); await reload(); toast('Запрос отклонён') }}>Отклонить</Btn>
              <Btn small onClick={async () => { await api.approveRequest(r.id); await reload(); toast('Одобрено') }}>Одобрить</Btn>
            </div>
          </Card>
        ))}

        {done.length > 0 && (
          <Section title="История">
            <Card className="divide-y divide-line p-0">
              {done.map((r) => (
                <Row
                  key={r.id} icon={REQ_ICON[r.type]} iconTone="gray"
                  title={requestText(r)} sub={`${r.child_name} · ${dateTime(r.created_at)}`}
                  right={<Badge tone={r.status === 'approved' ? 'solid' : 'redsoft'}>{r.status === 'approved' ? 'Одобрено' : 'Отказ'}</Badge>}
                />
              ))}
            </Card>
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
  const [child, setChild] = useState<number>(0)
  const [title, setTitle] = useState('')
  const [reward, setReward] = useState('2')
  const [xp, setXp] = useState('20')
  const kids = fam.data?.children ?? []
  const nameOf = (cid: number) => kids.find((k) => k.id === cid)?.name ?? ''

  if (!data) return <><Header title="Задания" /><Loading /></>
  const order = { done: 0, new: 1, rejected: 2, confirmed: 3 } as const
  const items = [...data.items].sort((a, b) => order[a.status] - order[b.status])
  const toCheck = items.filter((t) => t.status === 'done').length
  return (
    <>
      <Header title="Задания" subtitle={toCheck ? `${toCheck} на проверке` : 'Поручения с наградой'} />
      <div className="space-y-3 p-4">
        <Btn icon="plus" onClick={() => { setChild(kids[0]?.id ?? 0); setOpen(true) }}>Новое задание</Btn>
        {!items.length && <Empty text="Заданий пока нет" icon="tasks" />}
        {items.map((t) => (
          <Card key={t.id}>
            <TaskHead t={t} who={nameOf(t.assigned_to)} />
            {t.status === 'done' && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Btn small tone="danger" onClick={async () => { await api.taskReject(t.id); await reload() }}>Не выполнено</Btn>
                <Btn small onClick={async () => { await api.taskConfirm(t.id); await reload(); toast('Награда выплачена') }}>Подтвердить</Btn>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Новое задание">
        <div className="space-y-4">
          {kids.length > 0 && <Segmented<number> options={kids.map((k) => ({ id: k.id, label: k.name }))} value={child} onChange={setChild} />}
          <Field label="Что сделать" value={title} onChange={setTitle} placeholder="Например, помыть посуду" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Награда" inputMode="decimal" value={reward} onChange={setReward} suffix="BYN" />
            <Field label="Опыт" inputMode="numeric" value={xp} onChange={setXp} suffix="XP" />
          </div>
          <Btn onClick={async () => {
            const r = toCents(reward)
            const x = Number(xp)
            if (!child || !title.trim() || !(r >= 0) || !(x >= 0)) { toast('Заполните все поля'); return }
            await api.createTask({ assigned_to: child, title, reward_cents: r, xp_reward: Math.round(x) })
            setOpen(false); setTitle(''); await reload()
            toast('Задание отправлено')
          }}>Создать задание</Btn>
        </div>
      </Sheet>
    </>
  )
}
