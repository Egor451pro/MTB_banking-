import { useState } from 'react'
import { api } from '../api'
import { CATEGORY_ICON, CATEGORY_LABEL, REQ_LABEL, money, toCents } from '../format'
import { useData } from '../hooks'
import { useNav } from '../nav'
import { BalanceCard, Btn, Card, Chip, Empty, Field, Header, Loading, Progress, Section, Sheet, toast } from '../ui'
import type { Category, DeclineReason, PayResult, ReqType } from '../types'
import { GoalCard, TaskHead, TxList, requestText } from './shared'

// ───────── Главная ребёнка ─────────
export function ChildHome({ meId }: { meId: number }) {
  const { push, setTab } = useNav()
  const { data: c } = useData(() => api.getChild(meId), [meId], 2000)
  const reqs = useData(() => api.listRequests(), [], 2000)
  if (!c) return <Loading />
  const lim = c.limits_today
  const waiting = reqs.data?.items.filter((r) => r.status === 'pending').length ?? 0
  const lvlTotal = c.level.xp + c.level.xp_to_next
  return (
    <>
      <Header title={`Привет, ${c.name}!`} right={<Chip tone="gray">{c.age_group} лет</Chip>} />
      <div className="space-y-4 p-4">
        <BalanceCard card={c.card} title="Моя карта" sub={lim.limit_cents != null ? `Сегодня можно ещё ${money(lim.left_cents ?? 0)}` : undefined} />

        <Card onClick={() => setTab('level')} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold">🏆 Уровень {c.level.level}</div>
            <div className="text-sm text-slate-500">{c.level.xp} XP</div>
          </div>
          {c.level.xp_to_next > 0 ? <><Progress value={c.level.xp} max={lvlTotal} /><div className="text-xs text-slate-500">До уровня {c.level.level + 1}: {c.level.xp_to_next} XP</div></> : <div className="text-xs text-slate-500">Максимальный уровень</div>}
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Btn tone="ghost" onClick={() => setTab('pay')}>💳 Оплатить</Btn>
          <Btn tone="ghost" onClick={() => push({ name: 'request' })}>🙋 Попросить</Btn>
        </div>
        {waiting > 0 && <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">Ждут ответа родителя: {waiting}</div>}

        <Section title="Последние операции">
          <Card><TxList childId={meId} limit={5} poll={2000} /></Card>
        </Section>
      </div>
    </>
  )
}

// ───────── Симулятор оплаты (в проде это делает процессинг банка) ─────────
interface Merchant { name: string; category: Category; cents: number; online: boolean }
const MERCHANTS: Merchant[] = [
  { name: 'Столовая школы', category: 'food', cents: 300, online: false },
  { name: 'Автобус', category: 'transport', cents: 120, online: false },
  { name: 'Кофейня', category: 'food', cents: 500, online: false },
  { name: 'Игровой магазин', category: 'games', cents: 1500, online: true },
  { name: 'Онлайн-кинотеатр', category: 'subscriptions', cents: 500, online: true },
  { name: 'Сувенирная лавка', category: 'shopping', cents: 2000, online: false },
  { name: 'Магазин одежды (онлайн)', category: 'shopping', cents: 2500, online: true },
  { name: 'Алкомаркет', category: 'adult18', cents: 800, online: false },
]

export function ChildPay({ meId }: { meId: number }) {
  const { push } = useNav()
  const { data: c, reload } = useData(() => api.getChild(meId), [meId])
  const [res, setRes] = useState<{ m: Merchant; r: PayResult } | null>(null)
  if (!c) return <Loading />

  async function pay(m: Merchant) {
    const r = await api.simulatePayment({ card_id: c!.card.id, amount_cents: m.cents, category: m.category, merchant: m.name, is_online: m.online })
    setRes({ m, r })
    await reload()
  }

  // Что можно попросить у родителя в зависимости от причины отказа
  function askFor(m: Merchant, reason: DeclineReason | null) {
    if (reason === 'limit_exceeded') return { type: 'limit_increase' as ReqType, amount: m.cents }
    if (reason === 'category_blocked' && m.category !== 'adult18') return { type: 'category_unlock' as ReqType, category: m.category }
    if (reason === 'insufficient_funds') return { type: 'money' as ReqType, amount: m.cents }
    return null
  }

  const ask = res && res.r.status === 'declined' ? askFor(res.m, res.r.decline_reason) : null
  return (
    <>
      <Header title="Оплата" />
      <div className="space-y-3 p-4">
        <div className="rounded-xl bg-moby-50 px-3 py-2 text-sm text-moby-700">Демо: выберите покупку — банк проверит лимиты и правила родителя. Баланс: <b>{money(c.card.balance_cents)}</b></div>
        {MERCHANTS.map((m) => (
          <Card key={m.name} className="flex items-center gap-3">
            <div className="text-2xl">{CATEGORY_ICON[m.category]}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{m.name}</div>
              <div className="text-xs text-slate-500">{CATEGORY_LABEL[m.category]}{m.online ? ' · онлайн' : ''}</div>
            </div>
            <div className="w-24"><Btn small onClick={() => pay(m)}>{money(m.cents)}</Btn></div>
          </Card>
        ))}
      </div>

      <Sheet open={!!res} onClose={() => setRes(null)}>
        {res && (
          <div className="space-y-3 text-center">
            <div className="text-5xl">{res.r.status === 'approved' ? '✅' : res.r.status === 'pending' ? '⏳' : '⛔'}</div>
            <div className="text-xl font-bold">{res.r.status === 'approved' ? 'Оплачено' : res.r.status === 'pending' ? 'Ждём родителя' : 'Отказано'}</div>
            <div className="text-slate-600">{res.m.name} · {money(res.m.cents)}</div>
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">{res.r.message}</div>
            {ask && <Btn onClick={() => { const a = ask; setRes(null); push({ name: 'request', params: a }) }}>Попросить у родителя</Btn>}
            <Btn tone="ghost" onClick={() => setRes(null)}>Закрыть</Btn>
          </div>
        )}
      </Sheet>
    </>
  )
}

// ───────── Запрос родителю ─────────
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
      <div className="space-y-4 p-4">
        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(REQ_LABEL) as ReqType[]).map((k) => (
              <button key={k} onClick={() => setType(k)} className={`rounded-full px-3 py-1.5 text-sm ${type === k ? 'bg-moby-600 text-white' : 'bg-slate-100'}`}>{REQ_LABEL[k]}</button>
            ))}
          </div>
          {type !== 'category_unlock'
            ? <Field label={type === 'money' ? 'Сколько денег, BYN' : 'Какой дневной лимит нужен, BYN'} inputMode="decimal" value={amount} onChange={setAmount} />
            : <div className="flex flex-wrap gap-2">{cats.map((k) => <button key={k} onClick={() => setCategory(k)} className={`rounded-full px-3 py-1.5 text-sm ${category === k ? 'bg-moby-600 text-white' : 'bg-slate-100'}`}>{CATEGORY_ICON[k]} {CATEGORY_LABEL[k]}</button>)}</div>}
          <Field label="Зачем? (родитель увидит)" value={comment} onChange={setComment} placeholder="Например, на экскурсию" />
          <Btn onClick={async () => {
            const cents = toCents(amount)
            if (type !== 'category_unlock' && !(cents > 0)) { toast('Укажите сумму'); return }
            await api.createRequest({ type, amount_cents: type === 'category_unlock' ? undefined : cents, category: type === 'category_unlock' ? category : undefined, comment })
            setComment(''); setAmount(''); await reload(); toast('Запрос отправлен родителю')
          }}>Отправить</Btn>
        </Card>

        <Section title="Мои запросы">
          {!data?.items.length && <Empty text="Запросов пока нет" />}
          {data?.items.map((r) => (
            <Card key={r.id} className="flex items-center justify-between">
              <div><div className="font-medium">{requestText(r)}</div>{r.comment && <div className="text-sm text-slate-500">«{r.comment}»</div>}</div>
              <Chip tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{r.status === 'approved' ? 'Одобрено' : r.status === 'rejected' ? 'Отказ' : 'Ждёт'}</Chip>
            </Card>
          ))}
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
  if (!data) return <Loading />
  return (
    <>
      <Header title="Мои цели" />
      <div className="space-y-3 p-4">
        <Btn onClick={() => setCreate(true)}>＋ Новая цель</Btn>
        {!data.items.length && <Empty text="Поставьте первую цель — например, на велосипед" />}
        {data.items.map((g) => (
          <GoalCard key={g.id} g={g}>
            {g.status === 'active' && <Btn small tone="ghost" onClick={() => setDep({ id: g.id, title: g.title })}>Отложить деньги</Btn>}
          </GoalCard>
        ))}
      </div>

      <Sheet open={create} onClose={() => setCreate(false)} title="Новая цель">
        <div className="space-y-3">
          <Field label="На что копим" value={title} onChange={setTitle} placeholder="Велосипед" />
          <Field label="Сколько нужно, BYN" inputMode="decimal" value={target} onChange={setTarget} />
          <Btn onClick={async () => {
            const c = toCents(target)
            if (!title.trim() || !(c > 0)) { toast('Заполните название и сумму'); return }
            await api.createGoal(title, c)
            setCreate(false); setTitle(''); setTarget(''); await reload()
          }}>Создать</Btn>
        </div>
      </Sheet>

      <Sheet open={!!dep} onClose={() => setDep(null)} title={dep ? `В цель «${dep.title}»` : ''}>
        <div className="space-y-3">
          <Field label="Сумма, BYN" inputMode="decimal" value={sum} onChange={setSum} />
          <Btn onClick={async () => {
            const c = toCents(sum)
            if (!dep || !(c > 0)) { toast('Укажите сумму'); return }
            await api.depositGoal(dep.id, c)
            setDep(null); setSum(''); await reload(); toast('Отложено')
          }}>Отложить</Btn>
        </div>
      </Sheet>
    </>
  )
}

// ───────── Задания ─────────
export function ChildTasks() {
  const { data, reload } = useData(() => api.listTasks(), [], 3000)
  if (!data) return <Loading />
  return (
    <>
      <Header title="Задания" />
      <div className="space-y-3 p-4">
        {!data.items.length && <Empty text="Родитель пока не дал заданий" />}
        {data.items.map((t) => (
          <Card key={t.id} className="space-y-2">
            <TaskHead t={t} />
            {t.status === 'new' && <Btn small onClick={async () => { await api.taskDone(t.id); await reload(); toast('Отправлено родителю на проверку') }}>Я сделал(а)</Btn>}
          </Card>
        ))}
      </div>
    </>
  )
}

// ───────── Уровень доверия ─────────
export function ChildLevel({ meId }: { meId: number }) {
  const { data } = useData(() => api.getLevel(meId), [meId], 2000)
  if (!data) return <Loading />
  const total = data.xp + data.xp_to_next
  return (
    <>
      <Header title="Уровень доверия" />
      <div className="space-y-4 p-4">
        <Card className="space-y-2 text-center">
          <div className="text-5xl">🏆</div>
          <div className="text-2xl font-bold">Уровень {data.level}</div>
          <Progress value={data.xp} max={total} />
          <div className="text-sm text-slate-500">{data.xp_to_next > 0 ? `${data.xp} XP · до следующего ${data.xp_to_next}` : `${data.xp} XP · максимум`}</div>
        </Card>
        {data.suggestion && <div className="rounded-xl bg-moby-50 p-3 text-sm text-moby-900">Мы предложили родителю: «{data.suggestion.text}»</div>}
        <Section title="Уже открыто">
          <Card className="space-y-1">{data.unlocked.length ? data.unlocked.map((u) => <div key={u}>✅ {u}</div>) : <div className="text-slate-400">Пока ничего</div>}</Card>
        </Section>
        {data.next_unlocks.length > 0 && (
          <Section title="Откроется дальше">
            <Card className="space-y-1">{data.next_unlocks.map((u) => <div key={u} className="text-slate-600">🔒 {u}</div>)}</Card>
          </Section>
        )}
        <p className="px-1 text-xs text-slate-400">Выполняй задания и трать разумно — опыт растёт, а родитель открывает больше возможностей. В 18 лет карта становится взрослой.</p>
      </div>
    </>
  )
}
