import { useEffect, useRef, useState } from 'react'
import { api, session } from '../api'
import { CATEGORY_ICON, CATEGORY_LABEL, PERMISSION_INFO, dateShort, money, toCents } from '../format'
import { useData } from '../hooks'
import { Icon, type IconName } from '../icons'
import { useNav } from '../nav'
import {
  Avatar, BalanceCard, Badge, Btn, Card, Empty, Field, Header, IconTile, Loading, Note,
  Row, Section, Sheet, bonusBanner, toast,
} from '../ui'
import type { Category, DeclineReason, LessonResult, PayResult, PermissionKey, ReqType } from '../types'
import { GoalCard, REQ_ICON, TaskHead, TxList, requestText } from './shared'
import { BeaverPanel, LOGS_PER_LESSON, beaverInfo, damSrc, logWord } from './beaver'

// ───────── Главная ребёнка ─────────
export function ChildHome({ meId }: { meId: number }) {
  const { push, setTab } = useNav()
  const { data: c } = useData(() => api.getChild(meId), [meId], 2000)
  const reqs = useData(() => api.listRequests(), [], 2000)
  const al = useData(() => api.getAllowance(meId), [meId])
  if (!c) return <><Header title="Привет!" /><Loading /></>
  const waiting = reqs.data?.items.filter((r) => r.status === 'pending').length ?? 0

  const actions: { icon: IconName; label: string; go: () => void }[] = [
    { icon: 'qr', label: 'Оплатить', go: () => push({ name: 'qr' }) },
    { icon: 'chat', label: 'Попросить', go: () => push({ name: 'request' }) },
    { icon: 'target', label: 'Копилка', go: () => setTab('savings') },
    { icon: 'tasks', label: 'Задания', go: () => setTab('tasks') },
  ]
  const beaver = beaverInfo(meId)

  return (
    <>
      <Header title={`Привет, ${c.name}!`} subtitle="Детская карта" right={<Avatar name={c.name} light size={38} />} tall />
      <div className="-mt-12 space-y-5 px-4 pb-6">
        <BalanceCard card={c.card} title="Мой баланс" limit={c.limits_today} />

        <div className="grid grid-cols-4 gap-2">
          {actions.map((a) => (
            <button key={a.label} onClick={a.go} className="flex flex-col items-center gap-1.5 rounded-[20px] bg-card py-3 transition active:scale-[0.97]">
              <IconTile name={a.icon} />
              <span className="text-xs font-semibold text-mt-ink">{a.label}</span>
            </button>
          ))}
        </div>

        {al.data?.active && al.data.next_date && (
          <Note icon="calendar">Карманные {money(al.data.amount_cents)} {al.data.period === 'day' ? 'каждый день' : 'каждую неделю'} · следующие {dateShort(al.data.next_date)}</Note>
        )}
        {waiting > 0 && <Note icon="clock">Ждут ответа родителя: {waiting}</Note>}

        <button type="button" onClick={() => setTab('pet')} className="flex w-full items-center gap-3 rounded-[20px] bg-card p-3 text-left transition active:scale-[0.99]">
          <img src={damSrc(beaver.level.n)} alt="" className="h-14 w-16 shrink-0 rounded-[14px] object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-mt-ink">Бобёр · уровень {beaver.level.n}</div>
            <div className="text-[13px] text-muted">{beaver.level.title}{beaver.next ? `. До следующего ${Math.max(0, beaver.next.need - beaver.built)} ${logWord(Math.max(0, beaver.next.need - beaver.built))}` : ''}</div>
          </div>
          <Icon name="chevron-right" size={20} className="text-[#9AA6B8]" />
        </button>

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
  const { push, back } = useNav()
  const { data: c, reload } = useData(() => api.getChild(meId), [meId])
  const [res, setRes] = useState<{ m: Merchant; r: PayResult } | null>(null)
  if (!c) return <><Header title="Покупка картой" onBack={back} /><Loading /></>

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
      <Header title="Покупка картой" subtitle="Демо: банк проверяет каждую покупку" onBack={back} />
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
            <div className={`anim-pop flex h-16 w-16 items-center justify-center rounded-full ${result === 'approved' ? 'bg-[#2F6FE4] text-white' : result === 'pending' ? 'bg-tint text-mt-ink' : 'bg-mt-red text-white'}`}>
              <Icon name={result === 'approved' ? 'check' : result === 'pending' ? 'clock' : 'x'} size={32} strokeWidth={2.4} />
            </div>
            <div className="mt-4 text-[22px] font-bold tracking-tight text-mt-ink">
              {result === 'approved' ? 'Оплачено' : result === 'pending' ? 'Ждём родителя' : 'Покупка отклонена'}
            </div>
            <div className="mt-1 text-[15px] text-muted">{res.m.name} · <span className="tabular-nums">{money(res.m.cents)}</span></div>
            <div className="mt-4 w-full rounded-xl bg-elevated px-4 py-3 text-sm text-mt-ink">{res.r.message}</div>
            <div className="mt-5 w-full space-y-2">
              {ask && <Btn icon="chat"onClick={() => { const a = ask; setRes(null); push({ name: 'request', params: a }) }}>Попросить у родителя</Btn>}
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
  { id: 'product_access', title: 'Доступ к продукту', sub: 'Цели, вклад, виртуальная карта' },
]

export function RequestScreen({ type: t0, amount: a0, category: c0, permission: p0 }: { type?: ReqType; amount?: number; category?: Category; permission?: PermissionKey }) {
  const { back } = useNav()
  const [type, setType] = useState<ReqType>(t0 ?? 'money')
  const [amount, setAmount] = useState(a0 ? String(a0 / 100) : '')
  const [category, setCategory] = useState<Category>(c0 ?? 'games')
  const [comment, setComment] = useState('')
  const [permission, setPermission] = useState<PermissionKey | null>(p0 ?? null)
  const { data, reload } = useData(() => api.listRequests(), [], 2000)
  const perms = useData(() => api.getPermissions(session.userId), [])
  // Просить можно то, что выключено и не закрыто по возрасту
  const askable = (perms.data?.items ?? []).filter((p) => !p.enabled && !p.locked_reason)
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
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? 'border-[#2F6FE4]' : 'border-[#C9D5E3]'}`}>
                  {on && <span className="h-2.5 w-2.5 rounded-full bg-[#2F6FE4]" />}
                </span>
              </button>
            )
          })}
        </Card>

        {type === 'product_access' && (
          askable.length === 0
            ? <Note icon="check">Все доступные продукты уже открыты</Note>
            : (
              <Card className="divide-y divide-line p-0">
                {askable.map((p) => {
                  const on = permission === p.key
                  const info = PERMISSION_INFO[p.key]
                  return (
                    <button key={p.key} onClick={() => setPermission(p.key)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      <IconTile name={info.icon} tone={on ? 'solid' : 'blue'} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold text-mt-ink">{info.title}</div>
                        <div className="text-[13px] text-muted">{info.sub}</div>
                      </div>
                      {on && <Icon name="check" size={20} className="text-[#2F6FE4]" />}
                    </button>
                  )
                })}
              </Card>
            )
        )}

        {type === 'product_access' ? null : type !== 'category_unlock'
          ? <Field label={type === 'money' ? 'Сколько нужно' : 'Какой лимит нужен в день'} inputMode="decimal" value={amount} onChange={setAmount} placeholder="0" suffix="BYN" />
          : (
            <div className="grid grid-cols-3 gap-2">
              {cats.map((k) => {
                const on = category === k
                return (
                  <button key={k} onClick={() => setCategory(k)} className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 transition ${on ? 'border-[#2F6FE4] bg-tint' : 'border-transparent bg-card'}`}>
                    <Icon name={CATEGORY_ICON[k]} size={22} className={on ? 'text-[#2F6FE4]' : 'text-muted'} />
                    <span className={`text-xs font-semibold ${on ? 'text-[#2F6FE4]' : 'text-mt-ink'}`}>{CATEGORY_LABEL[k]}</span>
                  </button>
                )
              })}
            </div>
          )}

        <Field label="Зачем? Родитель увидит" value={comment} onChange={setComment} placeholder="Например, на экскурсию" />
        <Btn icon="chat" onClick={async () => {
          const cents = toCents(amount)
          const needsSum = type === 'money' || type === 'limit_increase'
          if (needsSum && !(cents > 0)) { toast('Укажите сумму'); return }
          if (type === 'product_access' && !permission) { toast('Выбери продукт'); return }
          await api.createRequest({
            type,
            amount_cents: needsSum ? cents : undefined,
            category: type === 'category_unlock' ? category : undefined,
            permission: type === 'product_access' ? permission ?? undefined : undefined,
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

// ───────── Копилка: цели ─────────
export function ChildSavings({ meId }: { meId: number }) {
  const { data } = useData(() => api.getGoals(meId), [meId], 3000)
  const saved = data ? data.items.reduce((s, g) => s + g.saved_cents, 0) : 0
  return (
    <>
      <Header title="Копилка" subtitle={data ? `Отложено ${money(saved)}` : undefined} />
      <div className="p-4">
        <GoalsPanel meId={meId} />
      </div>
    </>
  )
}

// ───────── Бобёр: отдельная вкладка ─────────
export function ChildBeaver({ meId, ageGroup }: { meId: number; ageGroup: string }) {
  return (
    <>
      <Header title="Бобёр" subtitle="Копи и выполняй задания, а бобёр строит плотину" />
      <div className="p-4">
        <BeaverPanel meId={meId} ageGroup={ageGroup} />
      </div>
    </>
  )
}

function GoalsPanel({ meId }: { meId: number }) {
  const { push } = useNav()
  const { data, reload } = useData(() => api.getGoals(meId), [meId], 3000)
  const perms = useData(() => api.getPermissions(meId), [meId], 3000)
  const [create, setCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [dep, setDep] = useState<{ id: number; title: string; percent: number } | null>(null)
  const [sum, setSum] = useState('')
  // Плашка, когда бонус родителя вошёл в накопления (сразу при взносе или после подтверждения)
  const bonusTotal = data ? data.items.reduce((s, g) => s + (g.bonus_cents ?? 0), 0) : null
  const seenBonus = useRef<number | null>(null)
  useEffect(() => {
    if (bonusTotal === null) return
    const key = `bonusSeen:${meId}`
    if (seenBonus.current === null) {
      try { const v = localStorage.getItem(key); if (v !== null) seenBonus.current = Number(v) } catch { /* хранилище недоступно */ }
    }
    if (seenBonus.current !== null && bonusTotal > seenBonus.current) {
      bonusBanner('Поступил бонус от родителя', `+ ${money(bonusTotal - seenBonus.current)} добавлено к накоплениям`)
    }
    seenBonus.current = bonusTotal
    try { localStorage.setItem(key, String(bonusTotal)) } catch { /* ничего страшного */ }
  }, [bonusTotal, meId])
  if (!data) return <Loading />
  return (
    <>
      <div className="space-y-3">
        {perms.data && !perms.data.items.find((p) => p.key === 'goals')?.enabled
          ? (
            <>
              <Note icon="lock">Родитель пока выключил цели</Note>
              <Btn icon="chat" onClick={() => push({ name: 'request', params: { type: 'product_access', permission: 'goals' } })}>Попросить доступ</Btn>
            </>
          )
          : <Btn icon="plus" onClick={() => setCreate(true)}>Новая цель</Btn>}
        {!data.items.length && <Empty text="Поставь первую цель — например, на велосипед" icon="target" />}
        {data.items.map((g) => (
          <GoalCard key={g.id} g={g}>
            {g.status === 'active' && <Btn small tone="secondary" icon="plus" onClick={() => setDep({ id: g.id, title: g.title, percent: g.parent_bonus_percent })}>Отложить</Btn>}
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
          {dep && dep.percent > 0 && (() => {
            // Показываем, сколько добавит родитель, ещё до нажатия кнопки
            const c = toCents(sum)
            const bonus = c > 0 ? Math.floor((c * dep.percent) / 100) : 0
            return (
              <Note icon="gift">
                {bonus > 0 && c > 1000 ? `Взнос больше 10 BYN: бонус +${money(bonus)} добавится после подтверждения родителя`
                  : bonus > 0 ? `Родитель добавит +${money(bonus)} (бонус +${dep.percent}%)` : `Родитель добавит +${dep.percent}% к каждому взносу`}
              </Note>
            )
          })()}
          <Btn onClick={async () => {
            const c = toCents(sum)
            if (!dep || !(c > 0)) { toast('Укажите сумму'); return }
            const r = await api.depositGoal(dep.id, c)
            setDep(null); setSum(''); await reload()
            if (r.bonus_pending_cents > 0) bonusBanner('Бонус ждёт родителя', `+ ${money(r.bonus_pending_cents)} — родитель должен подтвердить`)
            else if (r.bonus_cents <= 0) toast('Отложено')
          }}>Отложить с карты</Btn>
        </div>
      </Sheet>
    </>
  )
}

// ───────── Задания ─────────
export function ChildTasks() {
  const { push } = useNav()
  const { data, reload } = useData(() => api.listTasks(), [], 3000)
  const lessons = useData(() => api.getLessons(), [], 3000)
  if (!data) return <><Header title="Задания" /><Loading /></>
  const fresh = data.items.filter((t) => t.status === 'new').length
  const lessonsDone = lessons.data?.items.filter((l) => l.completed).length ?? 0
  return (
    <>
      <Header title="Задания" subtitle={fresh ? `Новых: ${fresh}` : 'Выполняй и получай награду'} />
      <div className="space-y-3 p-4">
        <div className="px-1 pt-1 text-[13px] font-semibold uppercase tracking-wide text-muted">От родителя</div>
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

        <div className="flex items-baseline justify-between px-1 pt-4">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-muted">Уроки</div>
          <div className="text-[13px] tabular-nums text-muted">{lessonsDone} из {lessons.data?.items.length ?? 0}</div>
        </div>
        <Card className="divide-y divide-line p-0">
          {(lessons.data?.items ?? []).map((l) => (
            <Row
              key={l.id} icon={l.completed ? 'check' : 'book'} iconTone={l.completed ? 'solid' : 'blue'} chevron
              title={l.title} sub={l.completed ? 'Пройден' : `${LOGS_PER_LESSON} ${logWord(LOGS_PER_LESSON)} и ${l.points_reward} баллов`}
              onClick={() => push({ name: 'lesson', params: { id: l.id } })}
            />
          ))}
        </Card>
      </div>
    </>
  )
}

// ───────── Я: уровень, баллы, что разрешил родитель ─────────
export function ChildMe({ meId }: { meId: number }) {
  const { push, setTab } = useNav()
  const { data: c } = useData(() => api.getChild(meId), [meId], 3000)
  const loyalty = useData(() => api.getLoyalty(), [], 3000)
  const perms = useData(() => api.getPermissions(meId), [meId], 3000)
  const reqs = useData(() => api.listRequests(), [], 3000)
  if (!c) return <><Header title="Я" /><Loading /></>
  const beaver = beaverInfo(meId)
  const waiting = reqs.data?.items.filter((r) => r.status === 'pending').length ?? 0
  return (
    <>
      <Header title={c.name} subtitle={`${c.age_group.replace('-', '–')} лет · карта •• ${c.card.last4}`} right={<Avatar name={c.name} light size={38} />} />
      <div className="space-y-5 p-4">
        <Card className="divide-y divide-line p-0">
          <Row
            icon="star" iconTone="solid" chevron onClick={() => setTab('pet')}
            title={`Уровень ${beaver.level.n} · ${beaver.level.title}`}
            sub={beaver.next ? `До следующего ${Math.max(0, beaver.next.need - beaver.built)} ${logWord(Math.max(0, beaver.next.need - beaver.built))}` : 'Все уровни пройдены'}
          />
          <Row
            icon="coins" chevron onClick={() => push({ name: 'loyalty' })}
            title={`${(loyalty.data?.points ?? 0).toLocaleString('ru-RU')} баллов`} sub="Скидки и подарки у партнёров"
          />
          <Row
            icon="chat" chevron onClick={() => push({ name: 'request' })}
            title="Мои запросы родителю" sub={waiting ? `Ждут ответа: ${waiting}` : 'Попросить деньги или доступ'}
          />
        </Card>

        <Section title="Что разрешил родитель">
          <Card className="divide-y divide-line p-0">
            {(perms.data?.items ?? []).map((p) => {
              const info = PERMISSION_INFO[p.key]
              return (
                <Row
                  key={p.key} icon={info.icon} iconTone={p.enabled ? 'blue' : 'gray'} title={info.title}
                  sub={p.enabled ? 'Можно' : p.locked_reason ?? 'Пока нельзя'}
                  right={p.enabled || p.locked_reason ? undefined : (
                    <Btn small full={false} tone="secondary" onClick={() => push({ name: 'request', params: { type: 'product_access', permission: p.key } })}>Попросить</Btn>
                  )}
                />
              )
            })}
          </Card>
        </Section>

        <p className="px-1 text-xs text-muted">В 18 лет предложим тебе взрослую карту. Перейти можно будет по желанию, баллы сохранятся.</p>
      </div>
    </>
  )
}

// ───────── Урок финансовой грамотности ─────────
export function LessonScreen({ id }: { id: number }) {
  const { back } = useNav()
  const { data, reload } = useData(() => api.getLessons(), [])
  const [picked, setPicked] = useState<number | null>(null)
  const [result, setResult] = useState<LessonResult | null>(null)
  const [wasDone, setWasDone] = useState(false)
  const lesson = data?.items.find((l) => l.id === id)
  if (!lesson) return <><Header title="Урок" onBack={back} /><Loading /></>
  return (
    <>
      <Header title={lesson.title} subtitle={lesson.description} onBack={back} />
      <div className="space-y-4 p-4">
        <Card className="space-y-3">
          {lesson.content.map((p, i) => <p key={i} className="text-[15px] leading-relaxed text-mt-ink">{p}</p>)}
        </Card>

        <Section title="Вопрос">
          <Card className="space-y-3">
            <p className="text-[15px] font-semibold text-mt-ink">{lesson.question}</p>
            {lesson.options.map((o, i) => {
              const chosen = picked === i
              const tone = result && chosen ? (result.correct ? 'border-[#2F6FE4] bg-tint' : 'border-mt-red bg-tint-red') : chosen ? 'border-[#2F6FE4]' : 'border-line'
              return (
                <button
                  key={i} disabled={!!result?.correct}
                  onClick={async () => {
                    setPicked(i)
                    setWasDone(lesson.completed)
                    try {
                      const r = await api.answerLesson(lesson.id, i)
                      setResult(r)
                      if (r.correct) await reload()
                    } catch (e) { toast((e as Error).message) }
                  }}
                  className={`w-full rounded-2xl border-2 px-4 py-3 text-left text-[15px] font-medium text-mt-ink transition ${tone}`}
                >
                  {o}
                </button>
              )
            })}
          </Card>
        </Section>

        {result && (
          <Note tone={result.correct ? 'blue' : 'red'} icon={result.correct ? 'check' : 'x'}>{result.explanation}</Note>
        )}
        {result?.correct && (
          <>
            <div className="text-center text-sm text-muted">
              {wasDone ? 'Урок уже был пройден, награда начисляется один раз' : `+${LOGS_PER_LESSON} ${logWord(LOGS_PER_LESSON)} и +${lesson.points_reward} баллов`}
            </div>
            <Btn onClick={back}>Готово</Btn>
          </>
        )}
      </div>
    </>
  )
}

// ───────── Оплата по QR через КРОК (национальный сервис мгновенных платежей) ─────────
// Демо: настоящей камеры и подключения к КРОК нет. Платёж идёт со счёта ребёнка через ту же
// проверку, что и карта: лимит, запрещённые категории, запрос родителю. Это оплата в магазине,
// поэтому она доступна и до 14 лет, в отличие от онлайн-покупок.
interface QrMerchant { name: string; category: Category; cents: number; seed: number }
const QR_MERCHANTS: QrMerchant[] = [
  { name: 'Столовая школы', category: 'food', cents: 300, seed: 3 },
  { name: 'Кофейня', category: 'food', cents: 450, seed: 7 },
  { name: 'Книжный магазин', category: 'education', cents: 900, seed: 11 },
  { name: 'Кинотеатр', category: 'entertainment', cents: 1200, seed: 5 },
  { name: 'Игровой клуб', category: 'games', cents: 1500, seed: 13 },
]

/** Рисует похожий на QR узор: для демо-кодов магазинов, а не настоящий код */
function FakeQr({ seed, size = 72 }: { seed: number; size?: number }) {
  const n = 21
  let x = seed * 9301 + 49297
  const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280 }
  const cells: [number, number][] = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const inFinder = (r < 8 && c < 8) || (r < 8 && c > n - 9) || (r > n - 9 && c < 8)
    if (!inFinder && rnd() > 0.52) cells.push([r, c])
  }
  const finder = (r: number, c: number) => (
    <g key={`${r}-${c}`}>
      <rect x={c} y={r} width="7" height="7" fill="#141416" />
      <rect x={c + 1} y={r + 1} width="5" height="5" fill="#fff" />
      <rect x={c + 2} y={r + 2} width="3" height="3" fill="#141416" />
    </g>
  )
  return (
    <svg width={size} height={size} viewBox={`-1 -1 ${n + 2} ${n + 2}`} className="rounded-md bg-white" aria-hidden>
      {cells.map(([r, c]) => <rect key={`${r}:${c}`} x={c} y={r} width="1" height="1" fill="#141416" />)}
      {finder(0, 0)}{finder(0, n - 7)}{finder(n - 7, 0)}
    </svg>
  )
}

export function QrPayScreen({ meId }: { meId: number }) {
  const { back, push } = useNav()
  const { data: c, reload } = useData(() => api.getChild(meId), [meId])
  const [step, setStep] = useState<'scan' | 'scanning' | 'confirm' | 'done'>('scan')
  const [m, setM] = useState<QrMerchant | null>(null)
  const [res, setRes] = useState<PayResult | null>(null)
  const [paying, setPaying] = useState(false)
  if (!c) return <><Header title="Оплата по QR" onBack={back} /><Loading /></>

  const scan = (qm: QrMerchant) => {
    setM(qm)
    setStep('scanning')
    window.setTimeout(() => setStep('confirm'), 900)
  }
  const pay = async () => {
    if (!m || paying) return
    setPaying(true)
    try {
      // В истории операций платёж подписан «· КРОК», так его видит и родитель
      const r = await api.simulatePayment({ card_id: c.card.id, amount_cents: m.cents, category: m.category, merchant: `${m.name} · КРОК`, is_online: false })
      setRes(r)
      setStep('done')
      await reload()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setPaying(false)
    }
  }
  const askFor = (): { type: ReqType; amount?: number; category?: Category } | null => {
    if (!m || !res || res.status !== 'declined') return null
    if (res.decline_reason === 'limit_exceeded') return { type: 'limit_increase', amount: m.cents }
    if (res.decline_reason === 'category_blocked') return { type: 'category_unlock', category: m.category }
    if (res.decline_reason === 'insufficient_funds') return { type: 'money', amount: m.cents }
    return null
  }
  const ask = askFor()
  const status = res?.status

  return (
    <>
      <Header title="Оплата по QR" subtitle="Через КРОК, со своего счёта, без карты" onBack={back} />
      <div className="space-y-4 p-4">
        {(step === 'scan' || step === 'scanning') && (
          <>
            <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-[28px] bg-[#0E1424]">
              {step === 'scanning' && m && (
                <div className="absolute inset-0 flex items-center justify-center"><FakeQr seed={m.seed} size={170} /></div>
              )}
              {/* уголки рамки и бегущая линия сканера */}
              {[['left-6 top-6', 'border-l-4 border-t-4 rounded-tl-xl'], ['right-6 top-6', 'border-r-4 border-t-4 rounded-tr-xl'], ['left-6 bottom-6', 'border-l-4 border-b-4 rounded-bl-xl'], ['right-6 bottom-6', 'border-r-4 border-b-4 rounded-br-xl']].map(([pos, b]) => (
                <span key={pos} className={`absolute ${pos} h-10 w-10 border-white ${b}`} />
              ))}
              <span className="qr-scanline absolute inset-x-8 h-0.5 rounded-full bg-[#4C86F0] shadow-[0_0_12px_2px_rgba(76,134,240,0.8)]" />
              <div className="absolute inset-x-0 bottom-3 text-center text-[13px] text-white/70">
                {step === 'scanning' ? 'Считываем код…' : 'Наведи камеру на QR-код продавца'}
              </div>
            </div>
            <Section title="Демо: QR-коды на кассе">
              <div className="grid grid-cols-2 gap-2">
                {QR_MERCHANTS.map((qm) => (
                  <button key={qm.name} type="button" disabled={step === 'scanning'} onClick={() => scan(qm)}
                    className="flex items-center gap-3 rounded-[20px] bg-card p-3 text-left transition active:scale-[0.98] disabled:opacity-60">
                    <FakeQr seed={qm.seed} size={44} />
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-mt-ink">{qm.name}</div>
                      <div className="text-[13px] tabular-nums text-muted">{money(qm.cents)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          </>
        )}

        {step === 'confirm' && m && (
          <Card className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-tint text-[#2F6FE4]"><Icon name={CATEGORY_ICON[m.category]} size={28} /></div>
            <div>
              <div className="text-[15px] text-muted">{m.name}</div>
              <div className="font-display text-[36px] font-bold tabular-nums text-mt-ink">{money(m.cents)}</div>
              <div className="text-[13px] text-muted">{CATEGORY_LABEL[m.category]} · спишется со счёта ребёнка</div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-elevated p-3 text-left text-[13px]">
              <div><div className="text-muted">На счёте</div><div className="font-semibold tabular-nums text-mt-ink">{money(c.card.balance_cents)}</div></div>
              <div><div className="text-muted">Можно сегодня</div><div className="font-semibold tabular-nums text-mt-ink">{c.limits_today.left_cents != null ? money(c.limits_today.left_cents) : 'без лимита'}</div></div>
            </div>
            <Btn onClick={pay} disabled={paying}>{paying ? 'Оплачиваем…' : 'Оплатить через КРОК'}</Btn>
            <Btn tone="secondary" onClick={() => setStep('scan')}>Отмена</Btn>
          </Card>
        )}

        {step === 'done' && m && res && (
          <Card className="flex flex-col items-center text-center">
            <div className={`anim-pop flex h-16 w-16 items-center justify-center rounded-full ${status === 'approved' ? 'bg-[#2F6FE4] text-white' : status === 'pending' ? 'bg-tint text-mt-ink' : 'bg-mt-red text-white'}`}>
              <Icon name={status === 'approved' ? 'check' : status === 'pending' ? 'clock' : 'x'} size={32} strokeWidth={2.4} />
            </div>
            <div className="mt-4 text-[22px] font-bold tracking-tight text-mt-ink">
              {status === 'approved' ? 'Оплачено' : status === 'pending' ? 'Ждём родителя' : 'Оплата отклонена'}
            </div>
            <div className="mt-1 text-[15px] text-muted">{m.name} · <span className="tabular-nums">{money(m.cents)}</span></div>
            <div className="mt-4 w-full rounded-xl bg-elevated px-4 py-3 text-sm text-mt-ink">{res.message}</div>
            <div className="mt-5 w-full space-y-2">
              {ask && <Btn icon="chat" onClick={() => push({ name: 'request', params: ask })}>Попросить у родителя</Btn>}
              <Btn tone="secondary" onClick={back}>Готово</Btn>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
