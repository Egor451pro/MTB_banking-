import { useState } from 'react'
import { api } from '../api'
import { CATEGORY_ICON, CATEGORY_LABEL, money, toCents } from '../format'
import { useData } from '../hooks'
import { Icon, type IconName } from '../icons'
import { useNav } from '../nav'
import {
  Avatar, BalanceCard, Badge, Btn, Card, Empty, Field, Header, IconTile, Loading, Note, Progress,
  Row, Section, Sheet, toast,
} from '../ui'
import type { Category, DeclineReason, PayResult, ReqType } from '../types'
import { GoalCard, LevelRing, REQ_ICON, TaskHead, TxList, requestText } from './shared'

// ───────── Главная ребёнка ─────────
export function ChildHome({ meId }: { meId: number }) {
  const { push, setTab } = useNav()
  const { data: c } = useData(() => api.getChild(meId), [meId], 2000)
  const reqs = useData(() => api.listRequests(), [], 2000)
  if (!c) return <><Header title="Привет!" /><Loading /></>
  const waiting = reqs.data?.items.filter((r) => r.status === 'pending').length ?? 0
  const lv = c.level

  const actions: { icon: IconName; label: string; go: () => void }[] = [
    { icon: 'card', label: 'Оплатить', go: () => setTab('pay') },
    { icon: 'chat', label: 'Попросить', go: () => push({ name: 'request' }) },
    { icon: 'target', label: 'Цели', go: () => setTab('goals') },
    { icon: 'tasks', label: 'Задания', go: () => setTab('tasks') },
  ]

  return (
    <>
      <Header title={`Привет, ${c.name}!`} subtitle="Детская карта" right={<Avatar name={c.name} light size={38} />} tall />
      <div className="-mt-12 space-y-5 px-4 pb-6">
        <BalanceCard card={c.card} title="Мой баланс" limit={c.limits_today} />

        <div className="grid grid-cols-4 gap-2">
          {actions.map((a) => (
            <button key={a.label} onClick={a.go} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-white py-3 transition active:bg-[#F4F9FF]">
              <IconTile name={a.icon} />
              <span className="text-xs font-semibold text-mt-ink">{a.label}</span>
            </button>
          ))}
        </div>

        {waiting > 0 && <Note icon="clock">Ждут ответа родителя: {waiting}</Note>}

        <Card onClick={() => setTab('level')}>
          <div className="flex items-center gap-3">
            <IconTile name="star" tone="solid" />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-mt-ink">Уровень {lv.level}</div>
              <div className="text-[13px] tabular-nums text-muted">{lv.xp_to_next > 0 ? `Ещё ${lv.xp_to_next} XP до уровня ${lv.level + 1}` : 'Максимальный уровень'}</div>
            </div>
            <Icon name="chevron-right" size={20} className="text-[#9AA6B8]" />
          </div>
          {lv.xp_to_next > 0 && <div className="mt-3"><Progress value={lv.xp} max={lv.xp + lv.xp_to_next} tone="brand" /></div>}
        </Card>

        <Section title="Последние операции">
          <TxList childId={meId} limit={5} poll={2000} />
        </Section>
      </div>
    </>
  )
}

// ───────── Оплата: демо-терминал (в проде это делает процессинг банка) ─────────
interface Merchant { name: string; category: Category; cents: number; online: boolean }
const MERCHANTS: Merchant[] = [
  { name: 'Столовая школы', category: 'food', cents: 300, online: false },
  { name: 'Автобус', category: 'transport', cents: 120, online: false },
  { name: 'Кофейня', category: 'food', cents: 500, online: false },
  { name: 'Книжный магазин', category: 'education', cents: 900, online: false },
  { name: 'Игровой магазин', category: 'games', cents: 1500, online: true },
  { name: 'Онлайн-кинотеатр', category: 'subscriptions', cents: 500, online: true },
  { name: 'Сувенирная лавка', category: 'shopping', cents: 2000, online: false },
  { name: 'Магазин одежды', category: 'shopping', cents: 2500, online: true },
  { name: 'Алкомаркет', category: 'adult18', cents: 800, online: false },
]

export function ChildPay({ meId }: { meId: number }) {
  const { push } = useNav()
  const { data: c, reload } = useData(() => api.getChild(meId), [meId])
  const [res, setRes] = useState<{ m: Merchant; r: PayResult } | null>(null)
  if (!c) return <><Header title="Оплата" /><Loading /></>

  async function pay(m: Merchant) {
    try {
      const r = await api.simulatePayment({ card_id: c!.card.id, amount_cents: m.cents, category: m.category, merchant: m.name, is_online: m.online })
      setRes({ m, r })
      await reload()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  // Что можно попросить у родителя, исходя из причины отказа
  function askFor(m: Merchant, reason: DeclineReason | null) {
    if (reason === 'limit_exceeded') return { type: 'limit_increase' as ReqType, amount: m.cents }
    if (reason === 'category_blocked' && m.category !== 'adult18') return { type: 'category_unlock' as ReqType, category: m.category }
    if (reason === 'insufficient_funds') return { type: 'money' as ReqType, amount: m.cents }
    return null
  }

  const ask = res && res.r.status === 'declined' ? askFor(res.m, res.r.decline_reason) : null
  const lim = c.limits_today
  const result = res?.r.status
  return (
    <>
      <Header title="Оплата" subtitle="Демо: банк проверяет каждую покупку" />
      <div className="space-y-5 p-4">
        <Card className="grid grid-cols-2 divide-x divide-line p-0">
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-muted">На карте</div>
            <div className="mt-0.5 text-lg font-bold tabular-nums text-mt-ink">{money(c.card.balance_cents)}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-muted">Можно сегодня</div>
            <div className="mt-0.5 text-lg font-bold tabular-nums text-mt-ink">{lim.left_cents != null ? money(lim.left_cents) : 'без лимита'}</div>
          </div>
        </Card>

        <Section title="Выберите покупку">
          <Card className="divide-y divide-line p-0">
            {MERCHANTS.map((m) => (
              <Row
                key={m.name} icon={CATEGORY_ICON[m.category]} onClick={() => pay(m)} chevron
                title={m.name}
                sub={`${CATEGORY_LABEL[m.category]}${m.online ? ' · онлайн' : ''}`}
                right={<span className="text-[15px] font-semibold tabular-nums text-mt-ink">{money(m.cents)}</span>}
              />
            ))}
          </Card>
        </Section>
      </div>

      <Sheet open={!!res} onClose={() => setRes(null)}>
        {res && (
          <div className="flex flex-col items-center text-center">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${result === 'approved' ? 'bg-mt-blue text-white' : result === 'pending' ? 'bg-mt-sky/50 text-mt-ink' : 'bg-mt-red text-white'}`}>
              <Icon name={result === 'approved' ? 'check' : result === 'pending' ? 'clock' : 'x'} size={32} strokeWidth={2.4} />
            </div>
            <div className="mt-4 text-[22px] font-bold tracking-tight text-mt-ink">
              {result === 'approved' ? 'Оплачено' : result === 'pending' ? 'Ждём родителя' : 'Покупка отклонена'}
            </div>
            <div className="mt-1 text-[15px] text-muted">{res.m.name} · <span className="tabular-nums">{money(res.m.cents)}</span></div>
            <div className="mt-4 w-full rounded-xl bg-[#F3F6FA] px-4 py-3 text-sm text-mt-ink">{res.r.message}</div>
            <div className="mt-5 w-full space-y-2">
              {ask && <Btn icon="chat" onClick={() => { const a = ask; setRes(null); push({ name: 'request', params: a }) }}>Попросить у родителя</Btn>}
              <Btn tone="secondary" onClick={() => setRes(null)}>Готово</Btn>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}

// ───────── Запрос родителю ─────────
const REQ_OPTIONS: { id: ReqType; title: string; sub: string }[] = [
  { id: 'money', title: 'Деньги на карту', sub: 'Не хватает на покупку' },
  { id: 'limit_increase', title: 'Поднять дневной лимит', sub: 'Нужна покупка дороже лимита' },
  { id: 'category_unlock', title: 'Открыть категорию', sub: 'Например, игры или подписки' },
]

export function RequestScreen({ type: t0, amount: a0, category: c0 }: { type?: ReqType; amount?: number; category?: Category }) {
  const { back } = useNav()
  const [type, setType] = useState<ReqType>(t0 ?? 'money')
  const [amount, setAmount] = useState(a0 ? String(a0 / 100) : '')
  const [category, setCategory] = useState<Category>(c0 ?? 'games')
  const [comment, setComment] = useState('')
  const { data, reload } = useData(() => api.listRequests(), [], 2000)
  const cats = (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => c !== 'adult18')

  return (
    <>
      <Header title="Попросить у родителя" onBack={back} />
      <div className="space-y-5 p-4">
        <Card className="divide-y divide-line p-0">
          {REQ_OPTIONS.map((o) => {
            const on = type === o.id
            return (
              <button key={o.id} onClick={() => setType(o.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <IconTile name={REQ_ICON[o.id]} tone={on ? 'solid' : 'blue'} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-mt-ink">{o.title}</div>
                  <div className="text-[13px] text-muted">{o.sub}</div>
                </div>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? 'border-mt-blue' : 'border-[#C9D5E3]'}`}>
                  {on && <span className="h-2.5 w-2.5 rounded-full bg-mt-blue" />}
                </span>
              </button>
            )
          })}
        </Card>

        {type !== 'category_unlock'
          ? <Field label={type === 'money' ? 'Сколько нужно' : 'Какой лимит нужен в день'} inputMode="decimal" value={amount} onChange={setAmount} placeholder="0" suffix="BYN" />
          : (
            <div className="grid grid-cols-3 gap-2">
              {cats.map((k) => {
                const on = category === k
                return (
                  <button key={k} onClick={() => setCategory(k)} className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 transition ${on ? 'border-mt-blue bg-mt-cloud' : 'border-line bg-white'}`}>
                    <Icon name={CATEGORY_ICON[k]} size={22} className={on ? 'text-mt-blue' : 'text-muted'} />
                    <span className={`text-xs font-semibold ${on ? 'text-mt-blue' : 'text-mt-ink'}`}>{CATEGORY_LABEL[k]}</span>
                  </button>
                )
              })}
            </div>
          )}

        <Field label="Зачем? Родитель увидит" value={comment} onChange={setComment} placeholder="Например, на экскурсию" />
        <Btn icon="chat" onClick={async () => {
          const cents = toCents(amount)
          if (type !== 'category_unlock' && !(cents > 0)) { toast('Укажите сумму'); return }
          await api.createRequest({
            type,
            amount_cents: type === 'category_unlock' ? undefined : cents,
            category: type === 'category_unlock' ? category : undefined,
            comment,
          })
          setComment(''); setAmount(''); await reload()
          toast('Запрос отправлен родителю')
        }}>Отправить запрос</Btn>

        <Section title="Мои запросы">
          {!data?.items.length
            ? <Empty text="Запросов пока нет" icon="chat" />
            : (
              <Card className="divide-y divide-line p-0">
                {data.items.map((r) => (
                  <Row
                    key={r.id} icon={REQ_ICON[r.type]} iconTone="gray" title={requestText(r)} sub={r.comment || undefined}
                    right={<Badge tone={r.status === 'approved' ? 'solid' : r.status === 'rejected' ? 'redsoft' : 'sky'}>{r.status === 'approved' ? 'Одобрено' : r.status === 'rejected' ? 'Отказ' : 'Ждёт'}</Badge>}
                  />
                ))}
              </Card>
            )}
        </Section>
      </div>
    </>
  )
}

// ───────── Цели ─────────
export function ChildGoals({ meId }: { meId: number }) {
  const { data, reload } = useData(() => api.getGoals(meId), [meId], 3000)
  const [create, setCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [dep, setDep] = useState<{ id: number; title: string } | null>(null)
  const [sum, setSum] = useState('')
  if (!data) return <><Header title="Мои цели" /><Loading /></>
  const saved = data.items.reduce((s, g) => s + g.saved_cents, 0)
  return (
    <>
      <Header title="Мои цели" subtitle={`Отложено ${money(saved)}`} />
      <div className="space-y-3 p-4">
        <Btn icon="plus" onClick={() => setCreate(true)}>Новая цель</Btn>
        {!data.items.length && <Empty text="Поставь первую цель — например, на велосипед" icon="target" />}
        {data.items.map((g) => (
          <GoalCard key={g.id} g={g}>
            {g.status === 'active' && <Btn small tone="secondary" icon="plus" onClick={() => setDep({ id: g.id, title: g.title })}>Отложить</Btn>}
          </GoalCard>
        ))}
      </div>

      <Sheet open={create} onClose={() => setCreate(false)} title="Новая цель">
        <div className="space-y-4">
          <Field label="На что копим" value={title} onChange={setTitle} placeholder="Велосипед" />
          <Field label="Сколько нужно" inputMode="decimal" value={target} onChange={setTarget} placeholder="0" suffix="BYN" />
          <Btn onClick={async () => {
            const c = toCents(target)
            if (!title.trim() || !(c > 0)) { toast('Заполните название и сумму'); return }
            await api.createGoal(title, c)
            setCreate(false); setTitle(''); setTarget(''); await reload()
          }}>Создать цель</Btn>
        </div>
      </Sheet>

      <Sheet open={!!dep} onClose={() => setDep(null)} title={dep ? `В цель «${dep.title}»` : ''}>
        <div className="space-y-4">
          <Field label="Сумма" inputMode="decimal" value={sum} onChange={setSum} placeholder="0" suffix="BYN" />
          <Btn onClick={async () => {
            const c = toCents(sum)
            if (!dep || !(c > 0)) { toast('Укажите сумму'); return }
            await api.depositGoal(dep.id, c)
            setDep(null); setSum(''); await reload()
            toast('Отложено')
          }}>Отложить с карты</Btn>
        </div>
      </Sheet>
    </>
  )
}

// ───────── Задания ─────────
export function ChildTasks() {
  const { data, reload } = useData(() => api.listTasks(), [], 3000)
  if (!data) return <><Header title="Задания" /><Loading /></>
  const fresh = data.items.filter((t) => t.status === 'new').length
  return (
    <>
      <Header title="Задания" subtitle={fresh ? `Новых: ${fresh}` : 'Выполняй и получай награду'} />
      <div className="space-y-3 p-4">
        {!data.items.length && <Empty text="Родитель пока не дал заданий" icon="tasks" />}
        {data.items.map((t) => (
          <Card key={t.id}>
            <TaskHead t={t} />
            {t.status === 'new' && (
              <div className="mt-4">
                <Btn small icon="check" onClick={async () => { await api.taskDone(t.id); await reload(); toast('Отправлено родителю на проверку') }}>Я сделал(а)</Btn>
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  )
}

// ───────── Уровень ─────────
export function ChildLevel({ meId }: { meId: number }) {
  const { data: c } = useData(() => api.getChild(meId), [meId], 2000)
  if (!c) return <><Header title="Мой уровень" /><Loading /></>
  const lv = c.level
  return (
    <>
      <Header title="Мой уровень" subtitle="Расти вместе с картой" tall />
      <div className="-mt-12 space-y-5 px-4 pb-6">
        <Card className="flex flex-col items-center py-6 text-center shadow-[0_12px_32px_-16px_rgba(20,20,22,0.35)]">
          <LevelRing level={lv} />
          <div className="mt-3 text-sm tabular-nums text-muted">
            {lv.xp} XP · {lv.xp_to_next > 0 ? `ещё ${lv.xp_to_next} до уровня ${lv.level + 1}` : 'максимальный уровень'}
          </div>
        </Card>

        <Section title="Как расти">
          <Card className="divide-y divide-line p-0">
            <Row icon="tasks" title="Выполняй задания" sub="За каждое — награда и опыт" />
            <Row icon="target" title="Копи на цели" sub="Родитель может добавить бонус" />
            <Row icon="shield" title="Трать с умом" sub="Укладывайся в дневной лимит" />
            <Row icon="arrow-up" title="В 18 лет" sub="Карта станет взрослой, история останется" />
          </Card>
        </Section>
      </div>
    </>
  )
}
