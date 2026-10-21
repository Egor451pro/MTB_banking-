import { useEffect, useState } from 'react'
import { api } from '../api'
import { dateTime, money } from '../format'
import { useData } from '../hooks'
import { Icon } from '../icons'
import { useNav } from '../nav'
import { Badge, Btn, Card, Field, Header, Loading, Note, Row, Sheet, toast } from '../ui'
import type { VirtualCard } from '../types'
import '../beaver.css'

// Виртуальная карта подростка (14–17 лет): выпуск в приложении, данные карты, заморозка,
// заказ пластиковой карты за деньги со счёта. Карта привязана к тому же счёту, поэтому лимиты,
// запреты и баланс те же, что у основной карты.

const groups = (n: string) => n.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim()

/** Карта в фирменном дизайне. Номер и имя пишем поверх чистой синей части картинки. */
export function CardArt({ holder, last4, expires, frozen, mini, className = '' }: {
  holder?: string | null; last4?: string | null; expires?: string | null; frozen?: boolean; mini?: boolean; className?: string
}) {
  return (
    <div className={`relative aspect-[1280/805] w-full overflow-hidden rounded-[20px] shadow-[0_18px_36px_-18px_rgba(20,30,80,0.6)] ${className}`}>
      <img src="/card/graduate.jpg" alt="Виртуальная карта МТБанка с бобром" draggable={false}
        className={`absolute inset-0 h-full w-full object-cover transition ${frozen ? 'grayscale brightness-75' : ''}`} />
      {!mini && <div className="absolute inset-x-0 bottom-0 p-[5%] text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
        <div className="font-display text-[15px] font-semibold tabular-nums tracking-[0.2em]">{last4 ? `•••• ${last4}` : '•••• ••••'}</div>
        <div className="mt-1 flex items-center gap-3 text-[11px] font-semibold tracking-wider">
          <span className="max-w-[60%] truncate">{holder || 'ВАШЕ ИМЯ'}</span>
          {expires && <span className="tabular-nums">{expires}</span>}
        </div>
      </div>}
      {frozen && !mini && (
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#141416]">
          <Icon name="lock" size={13} />Заморожена
        </div>
      )}
    </div>
  )
}

const PLASTIC_TEXT = { none: '', ordered: 'Изготавливается', ready: 'Готова' } as const

function plasticLine(v: VirtualCard) {
  const p = v.plastic
  if (p.status === 'none') return ''
  if (p.method === 'delivery') return p.status === 'ready' ? `Курьер везёт по адресу: ${p.address}` : `Доставим курьером: ${p.address}`
  return p.status === 'ready' ? 'Забери в отделении МТБанка, нужен паспорт' : 'Заберёшь в отделении МТБанка'
}

// ───────── Экран ребёнка ─────────
export function VirtualCardScreen({ meId, ageGroup }: { meId: number; ageGroup: string }) {
  const { back, push } = useNav()
  const vc = useData(() => api.getVirtualCard(meId), [meId], 3000)
  const me = useData(() => api.getChild(meId), [meId], 3000)
  const [holder, setHolder] = useState('')
  const [fresh, setFresh] = useState(false)           // только что выпустили: показываем анимацию
  const [shownUntil, setShownUntil] = useState(0)     // когда спрятать данные карты
  const [, tick] = useState(0)
  const [plastic, setPlastic] = useState(false)
  const [method, setMethod] = useState<'pickup' | 'delivery'>('pickup')
  const [address, setAddress] = useState('')

  useEffect(() => {
    if (!shownUntil) return
    const iv = window.setInterval(() => {
      if (Date.now() >= shownUntil) setShownUntil(0)
      tick((n) => n + 1)
    }, 500)
    return () => window.clearInterval(iv)
  }, [shownUntil])

  const v = vc.data
  const c = me.data
  if (!v || !c) return <><Header title="Виртуальная карта" onBack={back} /><Loading /></>

  const frozen = v.status === 'frozen'
  const showing = shownUntil > Date.now()
  const price = v.plastic_price_cents + (method === 'delivery' ? v.courier_fee_cents : 0)
  const enough = c.card.balance_cents >= price
  const teen = ageGroup === '14-17'

  const issue = async () => {
    try {
      await api.issueVirtualCard(meId, holder.trim() || c.name)
      setFresh(true)
      await vc.reload()
    } catch (e) { toast((e as Error).message) }
  }
  const order = async () => {
    try {
      await api.orderPlastic(meId, method, address)
      setPlastic(false)
      await Promise.all([vc.reload(), me.reload()])
      toast('Пластиковая карта заказана')
    } catch (e) { toast((e as Error).message) }
  }

  // ── не выпущена ──
  if (!v.issued) {
    return (
      <>
        <Header title="Виртуальная карта" subtitle="Карта МТБанка в телефоне" onBack={back} />
        <div className="space-y-4 p-4">
          <CardArt holder={(holder || c.name).toUpperCase()} className={v.available ? '' : 'opacity-60 grayscale'} />
          {v.available ? (
            <Card className="space-y-4">
              <Field label="Имя на карте" value={holder} onChange={setHolder} placeholder={c.name} />
              <p className="text-[13px] text-muted">Выпуск бесплатный. Карта привязана к твоему счёту, лимиты и запреты родителя действуют и на ней.</p>
              <Btn icon="card-plus" onClick={issue}>Выпустить карту</Btn>
            </Card>
          ) : (
            <Card className="space-y-3">
              <div className="text-[15px] font-semibold text-mt-ink">{teen ? 'Нужно разрешение родителя' : 'Откроется с 14 лет'}</div>
              <p className="text-[13px] text-muted">{v.locked_reason}</p>
              {teen && <Btn icon="chat" onClick={() => push({ name: 'request', params: { type: 'product_access', permission: 'virtual_card' } })}>Попросить у родителя</Btn>}
            </Card>
          )}
        </div>
      </>
    )
  }

  // ── выпущена ──
  const left = Math.max(0, Math.ceil((shownUntil - Date.now()) / 1000))
  return (
    <>
      <Header title="Виртуальная карта" subtitle="Карта МТБанка в телефоне" onBack={back} />
      <div className="space-y-4 p-4">
        <div className={fresh ? 'card-in' : ''}>
          <CardArt holder={v.holder} last4={v.last4} expires={showing ? v.expires : null} frozen={frozen} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Btn tone="secondary" icon="shield" onClick={() => setShownUntil(showing ? 0 : Date.now() + 15000)}>{showing ? 'Скрыть данные' : 'Показать данные'}</Btn>
          <Btn tone={frozen ? 'primary' : 'secondary'} icon={frozen ? 'unlock' : 'lock'} onClick={async () => {
            await api.setVirtualCardStatus(meId, frozen ? 'active' : 'frozen')
            await vc.reload()
            toast(frozen ? 'Карта разморожена' : 'Карта заморожена')
          }}>{frozen ? 'Разморозить' : 'Заморозить'}</Btn>
        </div>

        {showing && (
          <Card className="divide-y divide-line p-0">
            <Row title={<span className="font-display text-[19px] font-semibold tabular-nums tracking-wider">{groups(v.number ?? '')}</span>} sub="Номер карты" />
            <div className="grid grid-cols-2 divide-x divide-line">
              <Row title={<span className="tabular-nums">{v.expires}</span>} sub="Срок действия" />
              <Row title={<span className="tabular-nums">{v.cvc}</span>} sub="CVC-код" />
            </div>
            <div className="px-4 py-2.5 text-[13px] text-muted">Данные скроются через {left} с. Никому их не сообщай.</div>
          </Card>
        )}

        <Card className="space-y-1">
          <div className="flex items-baseline justify-between">
            <div className="text-[15px] font-semibold text-mt-ink">Счёт карты</div>
            <div className="text-[15px] font-semibold tabular-nums text-mt-ink">{money(c.card.balance_cents)}</div>
          </div>
          <p className="text-[13px] text-muted">Виртуальная карта и основная списывают деньги с одного счёта, лимиты общие.</p>
        </Card>

        <Card className="divide-y divide-line p-0">
          {v.plastic.status === 'none' ? (
            <Row
              icon="card" chevron onClick={() => setPlastic(true)}
              title="Пластиковая карта" sub={`Закажи с доставкой или забери в отделении, от ${money(v.plastic_price_cents)}`}
            />
          ) : (
            <Row
              icon="card" title="Пластиковая карта" sub={plasticLine(v)}
              right={<Badge tone={v.plastic.status === 'ready' ? 'solid' : 'sky'}>{PLASTIC_TEXT[v.plastic.status]}</Badge>}
            />
          )}
          {v.plastic.ordered_at && <div className="px-4 py-2.5 text-[13px] text-muted">Заказана {dateTime(v.plastic.ordered_at)}</div>}
        </Card>
      </div>

      <Sheet open={plastic} onClose={() => setPlastic(false)} title="Пластиковая карта">
        <div className="space-y-4">
          <p className="text-[13px] text-muted">Такая же карта, как в приложении, с твоим именем. Изготовление занимает несколько дней.</p>
          <Card className="divide-y divide-line p-0">
            {([
              { id: 'pickup', title: 'Забрать в отделении', sub: 'Нужен паспорт', cents: v.plastic_price_cents },
              { id: 'delivery', title: 'Доставка курьером', sub: 'Привезём по адресу', cents: v.plastic_price_cents + v.courier_fee_cents },
            ] as const).map((o) => {
              const on = method === o.id
              return (
                <button key={o.id} type="button" onClick={() => setMethod(o.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold text-mt-ink">{o.title}</div>
                    <div className="text-[13px] text-muted">{o.sub}</div>
                  </div>
                  <div className="text-[15px] font-semibold tabular-nums text-mt-ink">{money(o.cents)}</div>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? 'border-[#2F6FE4]' : 'border-[#C9D5E3]'}`}>
                    {on && <span className="h-2.5 w-2.5 rounded-full bg-[#2F6FE4]" />}
                  </span>
                </button>
              )
            })}
          </Card>
          {method === 'delivery' && <Field label="Адрес доставки" value={address} onChange={setAddress} placeholder="Минск, пр. Независимости, 1, кв. 10" />}
          <div className="flex items-baseline justify-between rounded-2xl bg-elevated px-4 py-3">
            <span className="text-[13px] text-muted">На счёте</span>
            <span className="text-[15px] font-semibold tabular-nums text-mt-ink">{money(c.card.balance_cents)}</span>
          </div>
          {!enough && (
            <Note tone="red" icon="alert">Не хватает {money(price - c.card.balance_cents)}. Попроси у родителя деньги на карту.</Note>
          )}
          {enough
            ? <Btn onClick={order}>Заказать за {money(price)}</Btn>
            : <Btn icon="chat" onClick={() => { setPlastic(false); push({ name: 'request', params: { type: 'money', amount: price - c.card.balance_cents } }) }}>Попросить у родителя</Btn>}
        </div>
      </Sheet>
    </>
  )
}

// ───────── Вход на экран карты: строка на главной и в профиле ─────────
export function CardEntry({ meId, variant }: { meId: number; variant: 'home' | 'row' }) {
  const { push } = useNav()
  const { data: v } = useData(() => api.getVirtualCard(meId), [meId], 4000)
  if (!v) return null
  const go = () => push({ name: 'vcard' })
  const sub = v.issued
    ? `•• ${v.last4}${v.status === 'frozen' ? ', заморожена' : ''}${v.plastic.status !== 'none' ? `, пластик: ${PLASTIC_TEXT[v.plastic.status].toLowerCase()}` : ''}`
    : v.available ? 'Выпусти бесплатно за минуту' : v.locked_reason ?? ''
  if (variant === 'row') {
    return <Row icon="card-plus" chevron onClick={go} title="Виртуальная карта" sub={sub} />
  }
  return (
    <button type="button" onClick={go} className="flex w-full items-center gap-3 rounded-[20px] bg-card p-3 text-left transition active:scale-[0.99]">
      <div className="w-16 shrink-0"><CardArt mini frozen={v.status === 'frozen'} className="!rounded-[10px] !shadow-none" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-mt-ink">Виртуальная карта</div>
        <div className="text-[13px] text-muted">{sub}</div>
      </div>
      <Icon name="chevron-right" size={20} className="text-[#9AA6B8]" />
    </button>
  )
}

// ───────── Для родителя: строка в карточке ребёнка и лист с управлением ─────────
export function ParentVirtualCard({ childId, childName }: { childId: number; childName: string }) {
  const { data: v, reload } = useData(() => api.getVirtualCard(childId), [childId], 4000)
  const [open, setOpen] = useState(false)
  if (!v) return null
  const sub = v.issued
    ? `•• ${v.last4}, ${v.status === 'frozen' ? 'заморожена' : 'активна'}${v.plastic.status !== 'none' ? `, пластик: ${PLASTIC_TEXT[v.plastic.status].toLowerCase()}` : ''}`
    : v.available ? 'Разрешена, ребёнок ещё не выпустил' : v.locked_reason ?? 'Выключена'
  return (
    <>
      <Row icon="card-plus" chevron onClick={() => setOpen(true)} title="Виртуальная карта" sub={sub} />
      <Sheet open={open} onClose={() => setOpen(false)} title={`Виртуальная карта ${childName}`}>
        <div className="space-y-4">
          {v.issued ? (
            <>
              <CardArt holder={v.holder} last4={v.last4} frozen={v.status === 'frozen'} />
              <p className="text-[13px] text-muted">Полный номер и CVC видит только ребёнок. Карта списывает деньги с того же счёта, лимиты и запреты общие.</p>
              {v.plastic.status !== 'none' && (
                <div className="rounded-2xl bg-elevated px-4 py-3 text-[13px] text-mt-ink">
                  <span className="font-semibold">Пластик: {PLASTIC_TEXT[v.plastic.status].toLowerCase()}.</span> {plasticLine(v)}
                </div>
              )}
              <Btn tone={v.status === 'frozen' ? 'primary' : 'danger'} icon={v.status === 'frozen' ? 'unlock' : 'lock'} onClick={async () => {
                await api.setVirtualCardStatus(childId, v.status === 'frozen' ? 'active' : 'frozen')
                await reload()
                toast(v.status === 'frozen' ? 'Карта разморожена' : 'Карта заморожена')
              }}>{v.status === 'frozen' ? 'Разморозить карту' : 'Заморозить карту'}</Btn>
            </>
          ) : (
            <p className="text-[15px] text-muted">
              {v.available
                ? `${childName} ещё не выпустил карту. Выпуск бесплатный, ему достаточно нажать «Выпустить» на вкладке «Я».`
                : `${v.locked_reason ?? ''}. Разрешить можно в разделе «Что разрешено» у ребёнка.`}
            </p>
          )}
        </div>
      </Sheet>
    </>
  )
}
