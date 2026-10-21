import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { dateTime, money, toCents } from '../format'
import { useData } from '../hooks'
import { Icon } from '../icons'
import { useNav } from '../nav'
import { BalanceCard, Btn, CARD_ART, ConfirmBtn, Card, Field, Header, Loading, Note, Progress, Row, Sheet, toast } from '../ui'
import type { Card as CardT, VirtualCard } from '../types'
import { TEEN_DESIGNS, useCardDesign, type CardSlot } from '../cardDesigns'
import '../beaver.css'

// Виртуальная карта подростка (14–17 лет): выпуск в приложении, данные карты, заморозка,
// отдельный баланс с переводами со счёта и обратно, заказ пластиковой карты за деньги со счёта.

const groups = (n: string) => n.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim()

/** Карта в фирменном дизайне. Номер и имя пишем поверх чистой синей части картинки. */
export function CardArt({ holder, last4, expires, frozen, mini, className = '', art }: {
  holder?: string | null; last4?: string | null; expires?: string | null; frozen?: boolean; mini?: boolean; className?: string; art?: string
}) {
  return (
    <div className={`relative aspect-[1280/805] w-full overflow-hidden rounded-[20px] shadow-[0_18px_36px_-18px_rgba(20,30,80,0.6)] ${className}`}>
      <img src={art ?? CARD_ART.virtual} alt="Виртуальная карта МТБанка" draggable={false}
        className={`absolute inset-0 h-full w-full object-cover transition ${frozen ? 'grayscale brightness-75' : ''}`} />
      {!mini && <div className="absolute inset-x-0 bottom-0 p-[5%] text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
        <div className="font-display text-[15px] font-semibold tabular-nums tracking-[0.2em]">{last4 ? `•••• ${last4}` : '•••• ••••'}</div>
        <div className="mt-1 flex items-center gap-3 text-[11px] font-semibold tracking-wider">
          <span className="max-w-[60%] truncate">{holder || 'ВАШЕ ИМЯ'}</span>
          {expires && <span className="tabular-nums">{expires}</span>}
        </div>
      </div>}
      {frozen && !mini && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#141416]">
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
  const [vDesign] = useCardDesign(meId, 'virtual')
  const [pickOpen, setPickOpen] = useState(false)
  const [method, setMethod] = useState<'pickup' | 'delivery'>('pickup')
  const [address, setAddress] = useState('')
  const [xfer, setXfer] = useState(false)
  const [dir, setDir] = useState<'to_card' | 'to_account'>('to_card')
  const [amount, setAmount] = useState('')

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

  const fromCents = dir === 'to_card' ? c.card.balance_cents : v.balance_cents
  const amountCents = toCents(amount)
  const xferOk = amountCents > 0 && amountCents <= fromCents
  const transfer = async () => {
    try {
      await api.transferVirtualCard(meId, dir, amountCents)
      setXfer(false); setAmount('')
      await Promise.all([vc.reload(), me.reload()])
      toast(dir === 'to_card' ? `${money(amountCents)} переведено на карту` : `${money(amountCents)} переведено на счёт`)
    } catch (e) { toast((e as Error).message) }
  }

  // ── не выпущена ──
  if (!v.issued) {
    return (
      <>
        <Header title="Виртуальная карта" subtitle="Карта МТБанка в телефоне" onBack={back} />
        <div className="space-y-4 p-4">
          <CardArt art={vDesign.src} holder={(holder || c.name).toUpperCase()} className={v.available ? '' : 'opacity-60 grayscale'} />
          {v.available ? (
            <Card className="space-y-4">
              <Field label="Имя на карте" value={holder} onChange={setHolder} placeholder={c.name} />
              <p className="text-[13px] text-muted">Выпуск бесплатный. У карты свой баланс: переводи на неё деньги со счёта, когда нужно, и обратно.</p>
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
          <CardArt art={vDesign.src} holder={v.holder} last4={v.last4} expires={showing ? v.expires : null} frozen={frozen} />
        </div>
        <Btn tone="secondary" icon="star" onClick={() => setPickOpen(true)}>Дизайн карты</Btn>
        <DesignPicker open={pickOpen} onClose={() => setPickOpen(false)} childId={meId} slot="virtual" title="Дизайн виртуальной карты" />

        <div className="grid grid-cols-2 gap-2">
          <Btn tone="secondary" icon="shield" onClick={() => setShownUntil(showing ? 0 : Date.now() + 15000)}>{showing ? 'Скрыть' : 'Данные'}</Btn>
          <ConfirmBtn ask={!frozen} title="Заморозить карту?" text="Оплата этой картой будет недоступна, пока ты её не разморозишь." confirmLabel="Заморозить" tone={frozen ? 'primary' : 'secondary'} icon={frozen ? 'unlock' : 'lock'} onClick={async () => {
            await api.setVirtualCardStatus(meId, frozen ? 'active' : 'frozen')
            await vc.reload()
            toast(frozen ? 'Карта разморожена' : 'Карта заморожена')
          }}>{frozen ? 'Разморозить' : 'Заморозить'}</ConfirmBtn>
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

        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[13px] text-muted">На виртуальной карте</div>
              <div className="font-display text-[22px] font-semibold tabular-nums text-mt-ink">{money(v.balance_cents)}</div>
            </div>
            <div>
              <div className="text-[13px] text-muted">На моём счёте</div>
              <div className="font-display text-[22px] font-semibold tabular-nums text-mt-ink">{money(c.card.balance_cents)}</div>
            </div>
          </div>
          <Btn icon="wallet" onClick={() => { setDir('to_card'); setAmount(''); setXfer(true) }}>Перевести</Btn>
        </Card>

        <Card className="divide-y divide-line p-0">
          {v.plastic.status === 'none' ? (
            <Row
              icon="card" chevron onClick={() => setPlastic(true)}
              title="Пластиковая карта" sub={`Закажи с доставкой или забери в отделении, от ${money(v.plastic_price_cents)}`}
            />
          ) : (
            <Row icon="card" title={`Пластик: ${PLASTIC_TEXT[v.plastic.status].toLowerCase()}`} sub={plasticLine(v)} />
          )}
          {v.plastic.ordered_at && <div className="px-4 py-2.5 text-[13px] text-muted">Заказана {dateTime(v.plastic.ordered_at)}</div>}
        </Card>
      </div>

      <Sheet open={xfer} onClose={() => setXfer(false)} title="Перевод между счётами">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-elevated p-1">
            {([['to_card', 'На карту'], ['to_account', 'На счёт']] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => { setDir(id); setAmount('') }}
                className={`h-10 rounded-xl text-[14px] font-semibold transition ${dir === id ? 'bg-card text-mt-ink shadow-sm' : 'text-muted'}`}>{label}</button>
            ))}
          </div>
          <div className="flex items-baseline justify-between rounded-2xl bg-elevated px-4 py-3">
            <span className="text-[13px] text-muted">{dir === 'to_card' ? 'Со счёта' : 'С виртуальной карты'}</span>
            <span className="text-[15px] font-semibold tabular-nums text-mt-ink">{money(fromCents)}</span>
          </div>
          <Field label="Сумма" value={amount} onChange={setAmount} placeholder="0" inputMode="decimal" suffix="BYN" />
          <div className="flex flex-wrap gap-2">
            {[500, 1000, 2000].filter((x) => x <= fromCents).map((x) => (
              <button key={x} type="button" onClick={() => setAmount(String(x / 100))} className="rounded-full bg-elevated px-3.5 py-1.5 text-[13px] font-semibold text-mt-ink">{money(x)}</button>
            ))}
            {fromCents > 0 && <button type="button" onClick={() => setAmount(String(fromCents / 100).replace('.', ','))} className="rounded-full bg-elevated px-3.5 py-1.5 text-[13px] font-semibold text-mt-ink">Всё</button>}
          </div>
          {amountCents > fromCents && <Note tone="red" icon="alert">Не хватает {money(amountCents - fromCents)}.</Note>}
          <Btn disabled={!xferOk} onClick={transfer}>{amountCents > 0 ? `Перевести ${money(amountCents)}` : 'Перевести'}</Btn>
          <p className="text-[13px] text-muted">Это твои деньги: перевод не расходует дневной лимит трат.</p>
        </div>
      </Sheet>

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
  const { data: v, error } = useData(() => api.getVirtualCard(meId), [meId], 4000)
  const [entryArt] = useCardDesign(meId, 'virtual')
  if (!v && !error) return null
  if (!v) {
    // сервер не ответил (например, бэкенд запущен со старым кодом): показываем причину вместо пустого места
    return variant === 'row'
      ? <Row icon="card-plus" title="Виртуальная карта" sub={`Не загрузилась: ${error}. Перезапусти бэкенд`} />
      : <div className="rounded-[20px] bg-card p-3 text-[13px] text-muted"><span className="font-semibold text-mt-ink">Виртуальная карта.</span> Не загрузилась: {error}. Перезапусти бэкенд.</div>
  }
  const go = () => push({ name: 'vcard' })
  const sub = v.issued
    ? `•• ${v.last4}${v.status === 'frozen' ? ', заморожена' : ''}${v.plastic.status !== 'none' ? `, пластик: ${PLASTIC_TEXT[v.plastic.status].toLowerCase()}` : ''}`
    : v.available ? 'Выпусти бесплатно за минуту' : v.locked_reason ?? ''
  if (variant === 'row') {
    return <Row icon="card-plus" chevron onClick={go} title="Виртуальная карта" sub={sub} />
  }
  return (
    <button type="button" onClick={go} className="flex w-full items-center gap-3 rounded-[20px] bg-card p-3 text-left transition active:scale-[0.99]">
      <div className="w-16 shrink-0"><CardArt art={entryArt.src} mini frozen={v.status === 'frozen'} className="!rounded-[10px] !shadow-none" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-mt-ink">Виртуальная карта</div>
        <div className="text-[13px] text-muted">{sub}</div>
      </div>
      <Icon name="chevron-right" size={20} className="text-[#9AA6B8]" />
    </button>
  )
}


// ───────── Выбор дизайна карты (14–17 лет) ─────────
export function DesignPicker({ open, onClose, childId, slot, title }: { open: boolean; onClose: () => void; childId: number; slot: CardSlot; title: string }) {
  const [cur, set] = useCardDesign(childId, slot)
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid grid-cols-2 gap-3 pb-2">
        {TEEN_DESIGNS.map((d) => {
          const on = d.id === cur.id
          return (
            <button key={d.id} type="button" onClick={() => { set(d.id); onClose() }} aria-label={`Дизайн «${d.name}»`} aria-pressed={on}
              className={`relative overflow-hidden rounded-[16px] bg-black text-left ring-2 transition active:scale-[0.98] ${on ? 'ring-mt-blue' : 'ring-transparent'}`}>
              <div className="aspect-[1016/638] w-full overflow-hidden">
                <img src={d.src} alt="" draggable={false} style={{ transform: 'scale(1.06)' }} className="h-full w-full object-cover" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-1.5 pt-5 text-[12px] font-semibold text-white">{d.name}</div>
              {on && <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-mt-blue text-white"><Icon name="check" size={14} /></div>}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

// ───────── Основная карта картинкой и лимит на сегодня (главная ребёнка) ─────────
type LimitToday = { limit_cents: number | null; spent_cents: number; left_cents: number | null }

export function CardFace({ art, card, label, chipTop }: { art: string; card: CardT; label: string; chipTop?: boolean }) {
  const blocked = card.status === 'blocked'
  const zoom = art === CARD_ART.kid ? 1.13 : 1.06
  return (
    <div className="relative">
      <div className={`relative aspect-[1016/638] w-full overflow-hidden rounded-[24px] bg-black ${blocked ? 'grayscale brightness-75' : ''}`}>
        <img src={art} alt={label} draggable={false} style={{ transform: `scale(${zoom})` }} className="h-full w-full object-cover" />
      </div>
      <div className={`absolute ${chipTop ? 'right-3 top-3' : 'bottom-3 left-3'} rounded-2xl bg-black/45 px-3 py-1.5 text-white backdrop-blur-sm`}>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/75">{blocked ? 'Заблокирована' : label} •• {card.last4}</div>
        <div className="font-display text-[17px] font-bold tabular-nums">{money(card.balance_cents)}</div>
      </div>
    </div>
  )
}

export function LimitStrip({ limit, blocked }: { limit?: LimitToday; blocked?: boolean }) {
  if (!limit || blocked) return null
  if (limit.limit_cents == null) return <div className="rounded-[20px] bg-card p-4 text-sm text-muted ring-1 ring-line">Дневной лимит не установлен</div>
  return (
    <div className="space-y-2 rounded-[20px] bg-card p-4 ring-1 ring-line">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">Можно потратить сегодня</span>
        <span className="font-semibold tabular-nums text-mt-ink">{money(limit.left_cents ?? 0)}</span>
      </div>
      <Progress value={limit.left_cents ?? 0} max={limit.limit_cents} />
      <div className="text-xs tabular-nums text-muted">Лимит {money(limit.limit_cents)} в день · потрачено {money(limit.spent_cents)}</div>
    </div>
  )
}

// ───────── Карусель карт подростка (14–17): виртуальная по умолчанию ⇄ основная, свайпом ─────────
export function CardsCarousel({ meId, card, limit }: { meId: number; card: CardT; limit?: LimitToday }) {
  const { push } = useNav()
  const { data: v, error } = useData(() => api.getVirtualCard(meId), [meId], 4000)
  const track = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const [pickOpen, setPickOpen] = useState(false)
  const [vDesign] = useCardDesign(meId, 'virtual')
  const [mDesign] = useCardDesign(meId, 'main')
  if (!v) return <div className="space-y-3"><BalanceCard card={card} title="Основная карта" limit={limit} art={mDesign.src} />{error && <CardEntry meId={meId} variant="home" />}</div>

  const onScroll = () => {
    const el = track.current
    if (el) setIdx(Math.round(el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)))
  }
  const goTo = (i: number) => {
    const el = track.current
    if (el) el.scrollTo({ left: i * (el.scrollWidth - el.clientWidth), behavior: 'smooth' })
  }
  const frozen = v.status === 'frozen'

  return (
    <div className="space-y-3">
      <div>
        <div ref={track} onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" onClick={() => push({ name: 'vcard' })} aria-label="Открыть виртуальную карту"
            className="relative block w-full shrink-0 snap-center snap-always text-left transition active:scale-[0.99]">
            <CardArt art={vDesign.src} holder={v.issued ? v.holder : null} last4={v.issued ? v.last4 : null} mini={!v.issued} frozen={frozen}
              className={`!rounded-[24px] !shadow-none ${v.issued ? '' : 'grayscale'}`} />
            {v.issued ? (
              <div className="absolute bottom-3 right-3 rounded-2xl bg-black/45 px-3 py-1.5 text-right text-white backdrop-blur-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-white/75">Виртуальная</div>
                <div className="font-display text-[17px] font-bold tabular-nums">{money(v.balance_cents)}</div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-[24px] bg-black/55 px-6 text-center text-white">
                <div className="font-display text-[20px] font-bold">Виртуальная карта</div>
                <div className="text-sm">{v.available ? 'Нажми, чтобы выпустить бесплатно за минуту' : v.locked_reason ?? ''}</div>
              </div>
            )}
          </button>
          <div className="w-full shrink-0 snap-center snap-always"><CardFace art={mDesign.src} card={card} label="Основная" /></div>
        </div>
        <div className="mt-3 flex justify-center gap-2">
          {[0, 1].map((i) => (
            <button key={i} type="button" onClick={() => goTo(i)} aria-label={i === 0 ? 'Виртуальная карта' : 'Основная карта'}
              className={`h-2 rounded-full transition-all ${idx === i ? 'w-6 bg-mt-blue' : 'w-2 bg-[#C9D1DE]'}`} />
          ))}
        </div>
        <div className="mt-2 flex justify-center">
          <button type="button" onClick={() => setPickOpen(true)} className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-[13px] font-semibold text-mt-blue ring-1 ring-line transition active:scale-[0.97]">
            <Icon name="star" size={15} />Сменить дизайн
          </button>
        </div>
        <DesignPicker open={pickOpen} onClose={() => setPickOpen(false)} childId={meId} slot={idx === 0 ? 'virtual' : 'main'} title={idx === 0 ? 'Дизайн виртуальной карты' : 'Дизайн основной карты'} />
      </div>
      <LimitStrip limit={limit} blocked={card.status === 'blocked'} />
    </div>
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
              <p className="text-[13px] text-muted">Полный номер и CVC видит только ребёнок. Баланс карты: {money(v.balance_cents)}. Деньги на неё ребёнок переводит со своего счёта.</p>
              {v.plastic.status !== 'none' && (
                <div className="rounded-2xl bg-elevated px-4 py-3 text-[13px] text-mt-ink">
                  <span className="font-semibold">Пластик: {PLASTIC_TEXT[v.plastic.status].toLowerCase()}.</span> {plasticLine(v)}
                </div>
              )}
              <ConfirmBtn ask={v.status !== 'frozen'} title="Заморозить карту?" text={`Оплата виртуальной картой ${childName} будет недоступна, пока вы её не разморозите.`} confirmLabel="Заморозить" tone={v.status === 'frozen' ? 'primary' : 'danger'} icon={v.status === 'frozen' ? 'unlock' : 'lock'} onClick={async () => {
                await api.setVirtualCardStatus(childId, v.status === 'frozen' ? 'active' : 'frozen')
                await reload()
                toast(v.status === 'frozen' ? 'Карта разморожена' : 'Карта заморожена')
              }}>{v.status === 'frozen' ? 'Разморозить карту' : 'Заморозить карту'}</ConfirmBtn>
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
