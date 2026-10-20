import { useEffect, useState } from 'react'
import { api } from '../api'
import { CATEGORY_ICON, CATEGORY_LABEL, PERMISSION_INFO, REQ_SHORT, ageFrom, ageLabel, dateShort, dateTime, money, plural, toCents } from '../format'
import { useData } from '../hooks'
import { Icon, type IconName } from '../icons'
import { useNav } from '../nav'
import {
  Avatar, BalanceCard, Badge, Btn, Card, Empty, Field, Header, IconTile, Loading, Note, Progress,
  FloatAction, Row, Section, Segmented, Sheet, Toggle, toast,
} from '../ui'
import type { Category, ChildDetail, ConsentType, LimitItem } from '../types'
import { GoalCard, REQ_ICON, TaskHead, TxList, TxRow, requestText } from './shared'

const CATS: Category[] = ['food', 'transport', 'education', 'shopping', 'entertainment', 'games', 'subscriptions', 'adult18']

// ───────── Главная родителя ─────────
export function ParentHome() {
  const { push, setTab } = useNav()
  const { data, reload } = useData(() => api.getFamily(), [], 3000)
  const pp = useData(() => api.listPendingPurchases(), [], 3000)
  if (!data) return <><Header title="Семья" /><Loading /></>
  const pending = data.children.reduce((s, c) => s + c.pending_requests, 0)
  const purchases = pp.data?.items.length ?? 0
  const waiting = [
    pending ? `${pending} ${plural(pending, 'запрос', 'запроса', 'запросов')}` : '',
    purchases ? `${purchases} ${plural(purchases, 'покупка', 'покупки', 'покупок')}` : '',
  ].filter(Boolean).join(' и ')
  const total = data.children.reduce((s, c) => s + c.card.balance_cents, 0)
  return (
    <>
      <Header title={data.family.name} subtitle="Семейный банкинг" right={<Avatar name="Мама" light size={38} />} />
      <div className="space-y-5 p-4">
        {waiting && (
          <Card onClick={() => setTab('requests')} className="flex items-center gap-3">
            <IconTile name="bell" tone="red" />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-mt-ink">{waiting}</div>
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

        <FamilyFeed kids={data.children} />

        <button onClick={async () => { await api.demoReset(); await reload(); toast('Демо-данные сброшены') }} className="mx-auto flex items-center gap-1.5 py-2 text-xs font-medium text-muted">
          <Icon name="refresh" size={14} />Сбросить демо-данные
        </button>
      </div>
    </>
  )
}

// Лента событий: последние операции всех детей (п. 3.1 ТЗ — «получает уведомления»)
function FamilyFeed({ kids }: { kids: { id: number; name: string }[] }) {
  const ids = kids.map((k) => k.id).join(',')
  const { data } = useData(async () => {
    const lists = await Promise.all(kids.map(async (k) => (await api.getTransactions(k.id, 4)).items.map((t) => ({ ...t, who: k.name }))))
    return lists.flat().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 5)
  }, [ids], 4000)
  if (!data || !data.length) return null
  return (
    <Section title="Последние события">
      <Card className="px-4 py-1">
        <div className="divide-y divide-line">{data.map((t) => <TxRow key={`${t.who}-${t.id}`} t={t} who={t.who} />)}</div>
      </Card>
    </Section>
  )
}

// ───────── Продукты: здесь, как и в Moby, оформляются новые продукты ─────────
export function ParentProducts() {
  const { push, setTab } = useNav()
  const fam = useData(() => api.getFamily(), [])
  const kids = fam.data?.children ?? []
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 p-4 pt-6">
        <button onClick={() => push({ name: 'package' })} className="relative block h-[150px] w-full overflow-hidden rounded-[20px] bg-gradient-to-br from-mt-blue via-[#2B5FDB] to-[#6AA6F3] p-5 text-left text-white">
          <div className="absolute -left-10 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 max-w-[58%]">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/75">Новое в Moby</div>
            <div className="mt-1 text-[26px] font-extrabold leading-none tracking-tight">Детская карта</div>
            <div className="mt-2 text-sm font-medium leading-snug text-white/90">с 7 лет — под вашим контролем</div>
          </div>
          <div className="absolute -right-5 top-7 h-[96px] w-[150px] rotate-[-12deg] rounded-[14px] bg-gradient-to-br from-mt-red to-mt-orange shadow-[0_18px_30px_-10px_rgba(0,0,0,0.45)]">
            <div className="absolute left-3.5 top-3.5 h-5 w-7 rounded-md bg-white/45" />
            <div className="absolute -right-4 -top-6 h-16 w-16 rounded-full bg-white/20 blur-md" />
            <div className="absolute bottom-3 right-3.5 text-[11px] font-bold tracking-[0.25em] text-white/90">KIDS</div>
          </div>
        </button>

        <Card className="p-0 py-1">
          <Row plain icon="card" title="Детские карты" sub={kids.length ? `Карты ваших детей: ${kids.length}` : 'Карт пока нет'} onClick={() => setTab('home')} />
          <Row plain icon="target" title="Цели детей" sub="Копилки и ваш бонус к накоплениям" onClick={() => kids[0] && push({ name: 'child', params: { id: kids[0].id } })} />
          <Row plain icon="tasks" title="Задания с наградой" sub="Поручения, за которые ребёнок получает деньги" onClick={() => setTab('tasks')} />
          <div className="mx-4 my-1 h-px bg-line" />
          <Row plain icon="shield" title="Детский пакет" sub="Карта и вход в Moby для ребёнка 7–17 лет" onClick={() => push({ name: 'package' })} />
          <Row plain icon="gift" title="Бонусы и партнёры" sub="Баллы за покупки, скидки для семьи" onClick={() => push({ name: 'loyalty' })} />
          <div className="mx-4 my-1 h-px bg-line" />
          <Row plain icon="wallet" title="Детский вклад" sub="Накопления на учёбу и крупные цели" right={<Badge tone="gray">Скоро</Badge>} />
          <Row plain icon="heart" title="Страхование ребёнка" sub="Спорт, путешествия, здоровье" right={<Badge tone="gray">Скоро</Badge>} />
        </Card>
      </div>
      <FloatAction icon="card-plus" label="Оформить" onClick={() => push({ name: 'package' })} />
    </div>
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
  const required: ConsentType[] = ['card_issue', 'moby_access', 'personal_data', ...(teen ? ['teen_info_sharing' as ConsentType] : [])]
  const okConsents = required.every((c) => consents.includes(c))

  const features: { icon: IconName; title: string; text: string }[] = [
    { icon: 'card', title: 'Детская карта', text: 'Дневной лимит и запрет категорий' },
    { icon: 'phone', title: 'Свой вход в Moby', text: 'Права зависят от возраста' },
    { icon: 'target', title: 'Цели и копилки', text: 'Можно добавлять бонус к накоплениям' },
    { icon: 'tasks', title: 'Задания с наградой', text: 'Ребёнок зарабатывает на поручениях' },
    teen
      ? { icon: 'globe', title: 'Онлайн-покупки', text: 'Крупные — только с вашим подтверждением' }
      : { icon: 'shield', title: 'Только офлайн-покупки', text: 'Онлайн откроется с 14 лет' },
    { icon: 'arrow-up', title: 'В 18 лет — взрослая карта', text: 'Предложим переход, баллы сохранятся' },
  ]

  const consentItems: { id: ConsentType; title: string; text: string; req: boolean }[] = [
    teen
      ? { id: 'card_issue', title: 'Согласие на договор подростка', text: 'Даю письменное согласие: подросток сам заключает договор и подтвердит его в своём Moby (ст. 25 ГК РБ)', req: true }
      : { id: 'card_issue', title: 'Договор от имени ребёнка', text: 'Я законный представитель и заключаю договор за ребёнка (ст. 27 ГК РБ)', req: true },
    { id: 'moby_access', title: 'Доступ ребёнка в Moby', text: 'Свой вход с правами, которые задаёте вы', req: true },
    { id: 'personal_data', title: 'Обработка персональных данных', text: 'Данные ребёнка используются только для обслуживания пакета (Закон № 99-З)', req: true },
    ...(teen ? [
      { id: 'teen_info_sharing' as ConsentType, title: 'Родитель видит операции', text: 'Подросток подтвердит в Moby, что вы видите операции и ставите лимиты', req: true },
      { id: 'online_payments' as ConsentType, title: 'Онлайн-платежи', text: 'Крупные покупки — с вашим подтверждением', req: false },
    ] : []),
  ]

  return (
    <>
      <Header title="Детский пакет" subtitle={`Шаг ${step + 1} из 3`} onBack={step > 0 ? () => setStep(step - 1) : back} />
      <div className="space-y-4 p-4">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[#2F6FE4]' : 'bg-[#C9D5E3]'}`} />)}
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
type Pane = 'limits' | 'settings' | 'ops' | 'progress'

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
          options={[{ id: 'limits', label: 'Лимиты' }, { id: 'settings', label: 'Права' }, { id: 'ops', label: 'История' }, { id: 'progress', label: 'Успехи' }]}
          value={pane} onChange={setPane}
        />

        {pane === 'limits' && <LimitsEditor childId={id} onSaved={reload} />}
        {pane === 'ops' && <TxList key={txKey + c.card.balance_cents} childId={id} limit={15} />}
        {pane === 'settings' && <><AllowanceCard childId={id} onPaid={reload} /><PermissionsCard childId={id} /><SecurityCard cardId={c.card.id} onDone={reload} /></>}
        {pane === 'progress' && <><LevelCard level={c.level} /><PointsCard childId={id} /><LessonsProgress childId={id} /><GoalsParent childId={id} /></>}
      </div>

      <Sheet open={topup} onClose={() => setTopup(false)} title={`Пополнить карту ${c.name}`}>
        <div className="space-y-4">
          <Field label="Сумма" inputMode="decimal" value={amount} onChange={setAmount} placeholder="0" suffix="BYN" />
          <div className="flex gap-2">
            {[5, 10, 20, 50].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} className="h-9 flex-1 rounded-[10px] bg-[#E9F1FE] text-sm font-semibold text-[#2F6FE4]">{v} BYN</button>
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
                  {locked ? 'Алкоголь, табак, азартные игры — запрещено банком' : allowed ? 'Разрешено' : 'Запрещено вами'}
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

// Карманные деньги: регулярный перевод от родителя (п. 4.1 ТЗ)
function AllowanceCard({ childId, onPaid }: { childId: number; onPaid: () => void }) {
  const { data, reload } = useData(() => api.getAllowance(childId), [childId])
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState<'day' | 'week'>('week')
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (!data) return
    setAmount(data.amount_cents ? String(data.amount_cents / 100) : '')
    setPeriod(data.period)
    setActive(data.active)
  }, [data])
  if (!data) return <Loading />
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <IconTile name="calendar" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-mt-ink">Карманные деньги</div>
          <div className="text-[13px] text-muted">
            {data.active && data.next_date ? `${money(data.amount_cents)} · следующий перевод ${dateShort(data.next_date)}` : 'Регулярный перевод выключен'}
          </div>
        </div>
        <Toggle on={active} onChange={setActive} />
      </div>
      {active && (
        <>
          <Field label="Сумма перевода" inputMode="decimal" value={amount} onChange={setAmount} placeholder="0" suffix="BYN" />
          <Segmented<'day' | 'week'> options={[{ id: 'day', label: 'Каждый день' }, { id: 'week', label: 'Каждую неделю' }]} value={period} onChange={setPeriod} />
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Btn small tone="secondary" onClick={async () => {
          const cents = active ? toCents(amount) : data.amount_cents
          if (active && !(cents > 0)) { toast('Укажите сумму'); return }
          await api.putAllowance(childId, { amount_cents: cents, period, active })
          await reload()
          toast(active ? 'Карманные деньги настроены' : 'Регулярный перевод выключен')
        }}>Сохранить</Btn>
        <Btn small disabled={!data.active} onClick={async () => {
          await api.payAllowance(childId)
          onPaid()
          toast(`Перевели ${money(data.amount_cents)}`)
        }}>Выплатить</Btn>
      </div>
    </Card>
  )
}

// Права ребёнка в Moby: продукты, функционал, операции (п. 2 и 3.1 ТЗ)
function PermissionsCard({ childId }: { childId: number }) {
  const { data, reload } = useData(() => api.getPermissions(childId), [childId], 3000)
  if (!data) return <Loading />
  return (
    <Section title="Права в Moby">
      <Card className="divide-y divide-line p-0">
        {data.items.map((p) => {
          const info = PERMISSION_INFO[p.key]
          return (
            <div key={p.key} className="flex items-center gap-3 px-4 py-3">
              <IconTile name={info.icon} tone={p.enabled ? 'blue' : 'gray'} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-mt-ink">{info.title}</div>
                <div className={`text-[13px] ${p.locked_reason ? 'text-mt-red' : 'text-muted'}`}>{p.locked_reason ?? info.sub}</div>
              </div>
              {p.locked_reason
                ? <Icon name="lock" size={20} className="mr-3 text-[#A3ABB8]" />
                : <Toggle on={p.enabled} onChange={async (v) => {
                    try {
                      await api.putPermissions(childId, [{ key: p.key, enabled: v }])
                      await reload()
                      toast(`${info.title}: ${v ? 'разрешено' : 'запрещено'}`)
                    } catch (e) { toast((e as Error).message) }
                  }} />}
            </div>
          )
        })}
      </Card>
    </Section>
  )
}

// Безопасность: потеря карты (п. 4.1 ТЗ)
function SecurityCard({ cardId, onDone }: { cardId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Section title="Безопасность">
        <Card className="p-0 py-1">
          <Row icon="alert" iconTone="red" title="Карта потеряна или украдена" sub="Заблокируем и перевыпустим" onClick={() => setOpen(true)} chevron />
          <Row icon="shield" title="Защита от мошенников" sub="Покупки 18+ и азартные игры запрещены банком" />
        </Card>
      </Section>
      <Sheet open={open} onClose={() => setOpen(false)} title="Карта потеряна?">
        <div className="space-y-4">
          <p className="text-[15px] text-muted">Старая карта сразу перестанет работать. Деньги останутся на счёте, а ребёнок получит новую карту.</p>
          <Btn tone="accent" onClick={async () => {
            const r = await api.reissueCard(cardId)
            setOpen(false)
            onDone()
            toast(`Карта перевыпущена: •• ${r.last4}`)
          }}>Заблокировать и перевыпустить</Btn>
        </div>
      </Sheet>
    </>
  )
}

function PointsCard({ childId }: { childId: number }) {
  const { data } = useData(() => api.getLoyalty(childId), [childId], 4000)
  if (!data) return null
  return (
    <Card className="flex items-center gap-3">
      <IconTile name="coins" />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-mt-ink">Баллы лояльности</div>
        <div className="text-[13px] text-muted">Кешбэк за покупки и награды за уроки</div>
      </div>
      <div className="text-lg font-bold tabular-nums text-mt-ink">{data.points.toLocaleString('ru-RU')}</div>
    </Card>
  )
}

// Прогресс по урокам финансовой грамотности (п. 4.1 ТЗ — «родитель видит прогресс»)
function LessonsProgress({ childId }: { childId: number }) {
  const { data } = useData(() => api.getLessons(childId), [childId], 4000)
  if (!data) return null
  const done = data.items.filter((l) => l.completed).length
  return (
    <Card>
      <div className="flex items-center gap-3">
        <IconTile name="book" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-mt-ink">Уроки финансовой грамотности</div>
          <div className="text-[13px] text-muted">Пройдено {done} из {data.items.length}</div>
        </div>
      </div>
      <div className="mt-3"><Progress value={done} max={data.items.length} /></div>
      <div className="mt-3 space-y-2">
        {data.items.map((l) => (
          <div key={l.id} className="flex items-center gap-2 text-sm">
            <Icon name={l.completed ? 'check' : 'clock'} size={16} className={l.completed ? 'text-[#2F6FE4]' : 'text-[#A3ABB8]'} />
            <span className={l.completed ? 'text-mt-ink' : 'text-muted'}>{l.title}</span>
          </div>
        ))}
      </div>
    </Card>
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
      <p className="mt-3 text-[13px] text-muted">Опыт начисляется за задания и уроки. Уровень мотивирует ребёнка, а лимиты и разрешения меняете только вы.</p>
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
  const pp = useData(() => api.listPendingPurchases(), [], 3000)
  if (!data) return <><Header title="Запросы" /><Loading /></>
  const pending = data.items.filter((r) => r.status === 'pending')
  const done = data.items.filter((r) => r.status !== 'pending')
  const purchases = pp.data?.items ?? []
  const total = pending.length + purchases.length
  return (
    <>
      <Header title="Запросы" subtitle={total ? `${total} ${plural(total, 'ждёт', 'ждут', 'ждут')} решения` : 'Всё рассмотрено'} />
      <div className="space-y-5 p-4">
        {!total && <Empty text="Новых запросов нет" />}

        {purchases.length > 0 && (
          <Section title="Подтвердить покупку">
            {purchases.map((t) => (
              <Card key={t.id}>
                <div className="flex items-center gap-3">
                  <Avatar name={t.child_name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold text-mt-ink">{t.child_name}</div>
                    <div className="text-xs text-muted">{dateTime(t.created_at)}</div>
                  </div>
                  <Badge tone="sky"><Icon name="globe" size={14} />Онлайн</Badge>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <div className="min-w-0 truncate text-[17px] font-semibold text-mt-ink">{t.merchant}</div>
                  <div className="shrink-0 text-xl font-bold tabular-nums text-mt-ink">{money(t.amount_cents)}</div>
                </div>
                <div className="text-[13px] text-muted">{t.category ? CATEGORY_LABEL[t.category] : 'Покупка'} · крупная покупка ждёт вашего решения</div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Btn small tone="danger" onClick={async () => { const r = await api.declinePurchase(t.id); await pp.reload(); toast(r.message) }}>Отклонить</Btn>
                  <Btn small onClick={async () => { const r = await api.approvePurchase(t.id); await pp.reload(); toast(r.message) }}>Подтвердить</Btn>
                </div>
              </Card>
            ))}
          </Section>
        )}

        {pending.length > 0 && purchases.length > 0 && <h2 className="px-1 text-[22px] font-bold tracking-tight text-mt-ink">Запросы детей</h2>}
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
            {r.comment && <div className="mt-2 rounded-xl bg-[#F3F5F8] px-3 py-2.5 text-sm text-mt-ink">«{r.comment}»</div>}
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
