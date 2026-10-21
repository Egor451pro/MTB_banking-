import type { Api } from './index'
import { session } from './index'
import type {
  AccessRequest, AgeGroup, Allowance, Category, DeclineReason, Goal, Lesson, LevelInfo, LimitItem,
  Offer, PayResult, Permission, PermissionKey, ReqStatus, Task, Transaction, VirtualCard,
} from '../types'
import { ageFrom, CATEGORY_LABEL } from '../format'

// Mock = «бэкенд в браузере». Те же эндпоинты и формы ответов, что в docs/api.md,
// плюс те же правила оплаты, что будут в services/payment_rules.py. Данные живут в памяти:
// перезагрузка страницы возвращает демо-семью (аналог POST /demo/reset).

interface UserRow {
  id: number; role: 'parent' | 'child'; name: string; family_id: number
  birth_date: string; xp: number; points: number
}
interface AccountRow { id: number; owner_id: number; last4: string; balance_cents: number; status: 'active' | 'blocked' }
interface TxRow extends Transaction { account_id: number }
interface ReqRow extends AccessRequest { }
interface DB {
  users: UserRow[]
  accounts: AccountRow[]
  limits: Record<number, LimitItem[]> // по id ребёнка
  txs: TxRow[]
  requests: ReqRow[]
  goals: (Goal & { child_id: number })[]
  tasks: Task[]
  perms: Record<number, Record<PermissionKey, boolean>> // права ребёнка в Moby
  allowance: Record<number, Omit<Allowance, 'next_date'>>
  lessonsDone: Record<number, number[]>
  bonuses: { id: number; child_id: number; goal_id: number; amount_cents: number; status: 'pending' | 'credited' | 'rejected'; created_at: string }[]  // крупные бонусы на подтверждении
  accepted: Record<number, boolean>    // принято ли предложение уровня
  seq: { tx: number; req: number; goal: number; task: number; user: number; acc: number; bonus: number }
}

// Бонус родителя к накоплениям: не больше 10 BYN в месяц на ребёнка (как на бэкенде)
const BONUS_CONFIRM_DEPOSIT = 1000  // если взнос больше 10 BYN, бонус к нему подтверждает родитель

// Уроки финансовой грамотности: правильный ответ знает только «сервер»
const LESSONS: (Omit<Lesson, 'completed'> & { answer: number; explanation: string })[] = [
  {
    id: 1, title: 'Что такое бюджет', description: 'Как распределить карманные деньги на неделю', xp_reward: 20, points_reward: 50,
    content: ['Бюджет — это план: сколько денег есть и на что их потратить.', 'Если разделить деньги на дни недели, их хватит до следующих карманных.'],
    question: 'У тебя 10 BYN на неделю. Как поступить разумнее?',
    options: ['Потратить всё в понедельник', 'Разделить на каждый день', 'Отдать другу на хранение'],
    answer: 1, explanation: 'По 1–2 BYN в день — и денег хватит на всю неделю.',
  },
  {
    id: 2, title: 'Как копить на цель', description: 'Считаем, сколько недель копить на мечту', xp_reward: 20, points_reward: 50,
    content: ['Цель — это сумма и срок. Чем больше откладываешь, тем быстрее её достигнешь.', 'Родитель может добавить бонус к накоплениям — так копится быстрее.'],
    question: 'Велосипед стоит 300 BYN, ты откладываешь 10 BYN в неделю. Сколько недель копить?',
    options: ['10 недель', '30 недель', '300 недель'],
    answer: 1, explanation: '300 ÷ 10 = 30 недель. С бонусом родителя получится быстрее.',
  },
  {
    id: 3, title: 'Осторожно, мошенники', description: 'Почему код из СМС нельзя называть никому', xp_reward: 30, points_reward: 80,
    content: ['Мошенники обещают призы и просят код из СМС или данные карты.', 'Банк никогда не спрашивает код. Если просят — это обман.'],
    question: 'Тебе пишут: «Назови код из СМС и получишь приз». Что делать?',
    options: ['Назвать код', 'Никому не сообщать и рассказать родителю', 'Переслать сообщение другу'],
    answer: 1, explanation: 'Код из СМС — ключ к твоим деньгам. Не сообщай его никому и покажи сообщение родителю.',
  },
  {
    id: 4, title: 'Импульсивные покупки', description: 'Правило суток перед покупкой', xp_reward: 20, points_reward: 50,
    content: ['Иногда хочется купить что-то прямо сейчас, а через день желание проходит.', 'Подожди сутки перед крупной покупкой — так тратишь только на то, что действительно нужно.'],
    question: 'Хочешь игру за 15 BYN прямо сейчас. Что поможет решить?',
    options: ['Купить сразу', 'Подождать сутки и подумать', 'Занять деньги у друга'],
    answer: 1, explanation: 'Если через сутки игра всё ещё нужна — можно копить или попросить родителя.',
  },
  {
    id: 5, title: 'Деньги закончились: что делать', description: 'Почему не хватило и как попросить у родителя', xp_reward: 20, points_reward: 50,
    content: ['Покупку могут отклонить, если на карте мало денег или закончился дневной лимит.', 'Это не ошибка. Можно подождать до завтра или отправить родителю запрос — он решит, что делать.'],
    question: 'Покупку отклонили: не хватило денег. Что разумнее сделать?',
    options: ['Попросить у друга карту', 'Подождать или отправить запрос родителю', 'Ничего, просто обидеться'],
    answer: 1, explanation: 'Запрос родителю в приложении — спокойный и честный способ. Решение всегда за ним.',
  },
]

// Кешбэк баллами в семейных категориях (1 балл = 1 копейка)
const CASHBACK: { category: Category; percent: number }[] = [
  { category: 'education', percent: 5 },
  { category: 'transport', percent: 3 },
  { category: 'food', percent: 2 },
  { category: 'entertainment', percent: 2 },
]

const OFFERS: Offer[] = [
  { id: 1, partner: 'Детский развлекательный центр', title: 'Скидка 20% на батуты', description: 'Для всей семьи по выходным', audience: 'family', points_cost: 300 },
  { id: 2, partner: 'Книжный магазин', title: 'Скидка 10% на книги', description: 'Учебники и художественная литература', audience: 'child', points_cost: 150 },
  { id: 3, partner: 'Спортивная секция', title: 'Пробное занятие бесплатно', description: 'Плавание, футбол, танцы', audience: 'child', points_cost: 200 },
  { id: 4, partner: 'Медицинский центр', title: 'Скидка 15% на детского врача', description: 'Плановые осмотры и справки', audience: 'parent', points_cost: 500 },
  { id: 5, partner: 'Онлайн-школа', title: 'Месяц курса со скидкой 25%', description: 'Программирование и английский', audience: 'family', points_cost: 400 },
]

const PERM_KEYS: PermissionKey[] = ['online_payments', 'goals', 'virtual_card', 'savings', 'partner_offers']
const defaultPerms = (teen: boolean, online: boolean): Record<PermissionKey, boolean> =>
  // Предложения партнёров по умолчанию выключены: родитель включает их сам
  ({ online_payments: teen && online, goals: true, virtual_card: false, savings: false, partner_offers: false })

// Пороги опыта: индекс = уровень-1
const XP_STEPS = [0, 50, 120, 200, 320, 500]
const UNLOCKS = [
  [],
  ['Дневной лимит до 15 BYN'],
  ['Подписки до 5 BYN в месяц'],
  ['Онлайн-покупки с подтверждением родителя'],
  ['Свои цели с бонусом от родителя'],
  ['Подготовка к взрослой карте'],
]

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120))

function seed(): DB {
  return {
    users: [
      { id: 1, role: 'parent', name: 'Мама', family_id: 1, birth_date: '1988-04-10', xp: 0, points: 1250 },
      { id: 2, role: 'child', name: 'Миша', family_id: 1, birth_date: '2016-03-02', xp: 100, points: 340 },
      { id: 3, role: 'child', name: 'Аня', family_id: 1, birth_date: '2011-06-20', xp: 260, points: 820 },
    ],
    accounts: [
      { id: 10, owner_id: 2, last4: '4412', balance_cents: 1250, status: 'active' },
      { id: 11, owner_id: 3, last4: '7781', balance_cents: 4300, status: 'active' },
    ],
    limits: {
      2: [
        { id: 1, category: null, period: 'day', amount_cents: 1000, is_blocked: false },
        { id: 2, category: 'games', period: 'day', amount_cents: 0, is_blocked: true },
        { id: 3, category: 'subscriptions', period: 'day', amount_cents: 0, is_blocked: true },
      ],
      3: [
        { id: 4, category: null, period: 'day', amount_cents: 2500, is_blocked: false },
        { id: 5, category: 'games', period: 'day', amount_cents: 0, is_blocked: true },
      ],
    },
    txs: [
      { id: 1, account_id: 10, amount_cents: 2000, direction: 'in', category: null, merchant: 'Пополнение от родителя', status: 'approved', decline_reason: null, created_at: minutesAgo(60 * 26) },
      { id: 2, account_id: 10, amount_cents: 300, direction: 'out', category: 'food', merchant: 'Столовая школы', status: 'approved', decline_reason: null, created_at: minutesAgo(60 * 25) },
      { id: 3, account_id: 10, amount_cents: 120, direction: 'out', category: 'transport', merchant: 'Автобус', status: 'approved', decline_reason: null, created_at: minutesAgo(60 * 24) },
      { id: 4, account_id: 10, amount_cents: 1500, direction: 'out', category: 'games', merchant: 'Игровой магазин', status: 'declined', decline_reason: 'category_blocked', created_at: minutesAgo(60 * 5) },
      { id: 5, account_id: 11, amount_cents: 500, direction: 'out', category: 'food', merchant: 'Кофейня', status: 'approved', decline_reason: null, created_at: minutesAgo(60 * 3) },
      { id: 6, account_id: 11, amount_cents: 2500, direction: 'out', category: 'shopping', merchant: 'Магазин одежды', status: 'pending', decline_reason: null, created_at: minutesAgo(40) },
    ],
    requests: [
      { id: 1, child_id: 2, child_name: 'Миша', type: 'money', amount_cents: 500, category: null, comment: 'На экскурсию', status: 'pending', created_at: minutesAgo(20) },
    ],
    goals: [
      { id: 1, child_id: 2, title: 'Велосипед', target_cents: 30000, saved_cents: 5000, parent_bonus_percent: 10, status: 'active' },
    ],
    tasks: [
      { id: 1, assigned_to: 2, title: 'Убрать в комнате', reward_cents: 200, xp_reward: 30, status: 'new', due_date: null },
      { id: 2, assigned_to: 2, title: 'Вынести мусор', reward_cents: 100, xp_reward: 15, status: 'done', due_date: null },
    ],
    perms: { 2: { ...defaultPerms(false, false), partner_offers: true }, 3: { ...defaultPerms(true, true), savings: true, partner_offers: true, virtual_card: true } },
    allowance: { 2: { amount_cents: 1000, period: 'week', active: true }, 3: { amount_cents: 2000, period: 'week', active: true } },
    lessonsDone: { 3: [1, 3] },
    accepted: {},
    bonuses: [],
    seq: { tx: 6, req: 1, goal: 1, task: 2, user: 3, acc: 11, bonus: 0 },
  }
}

class MockError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}

export function mockApi(): Api {
  let db = seed()
  // Бобёр: то же правило, что на сервере: побеждает более новое состояние
  let beavers: Record<number, { data: Record<string, unknown>; updated_at: number }> = {}
  // Виртуальные карты подростков (на сервере это таблица virtual_cards)
  interface VCardRow { balance: number; holder: string; number: string; expires: string; cvc: string; status: 'active' | 'frozen'; method: 'pickup' | 'delivery' | null; address: string | null; orderedAt: number | null }
  let vcards: Record<number, VCardRow> = {}
  // Разовые добавки к дневному лимиту: действуют до конца дня и не меняют сам лимит
  let limitExtras: { childId: number; extra: number; day: number }[] = []
  const PLASTIC_PRICE = 1500, COURIER_FEE = 500, PLASTIC_READY_MS = 60_000
  const luhnNumber = () => {
    let body = '9112'
    while (body.length < 15) body += Math.floor(Math.random() * 10)
    let sum = 0
    ;[...body].reverse().forEach((ch, i) => { let d = Number(ch); if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9 } sum += d })
    return body + String((10 - (sum % 10)) % 10)
  }
  const rub = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} BYN`
  function decideBonus(id: number, approve: boolean) {
    const m = requireParent()
    const b = db.bonuses.find((x) => x.id === id)
    if (!b || user(b.child_id).family_id !== m.family_id) throw new MockError('not_found', 'Бонус не найден')
    if (b.status !== 'pending') throw new MockError('conflict', 'Бонус уже обработан')
    const g = db.goals.find((x) => x.id === b.goal_id)!
    b.status = approve ? 'credited' : 'rejected'
    if (approve) {
      g.saved_cents += b.amount_cents
      g.bonus_cents = (g.bonus_cents ?? 0) + b.amount_cents
      if (g.saved_cents >= g.target_cents) g.status = 'done'
    }
    return delay({ id, status: b.status as 'credited' | 'rejected', saved_cents: g.saved_cents })
  }

  const user = (id: number) => {
    const u = db.users.find((x) => x.id === id)
    if (!u) throw new MockError('not_found', 'Пользователь не найден')
    return u
  }
  const me = () => user(session.userId)
  const ageGroup = (u: UserRow): AgeGroup => (ageFrom(u.birth_date) >= 14 ? '14-17' : '7-13')
  const card = (childId: number) => {
    const a = db.accounts.find((x) => x.owner_id === childId)
    if (!a) throw new MockError('not_found', 'Карта не найдена')
    return a
  }
  const cardById = (id: number) => {
    const a = db.accounts.find((x) => x.id === id)
    if (!a) throw new MockError('not_found', 'Карта не найдена')
    return a
  }
  // Проверка доступа: родитель — к детям своей семьи, ребёнок — только к себе
  function access(childId: number) {
    const c = user(childId)
    const m = me()
    const ok = m.role === 'parent' ? c.family_id === m.family_id : m.id === c.id
    if (!ok) throw new MockError('forbidden', 'Нет доступа')
    return c
  }
  function requireParent() {
    const m = me()
    if (m.role !== 'parent') throw new MockError('forbidden', 'Только для родителя')
    return m
  }
  function requireChild() {
    const m = me()
    if (m.role !== 'child') throw new MockError('forbidden', 'Только для ребёнка')
    return m
  }

  const isTeen = (u: UserRow) => ageFrom(u.birth_date) >= 14
  const vcardView = (childId: number): VirtualCard => {
    const owner = me().id === childId
    const p = permList(childId).find((x) => x.key === 'virtual_card')
    const locked = p?.locked_reason ?? (p?.enabled ? null : 'Родитель ещё не разрешил виртуальную карту')
    const v = vcards[childId]
    const base = { available: !locked, locked_reason: locked, plastic_price_cents: PLASTIC_PRICE, courier_fee_cents: COURIER_FEE }
    if (!v) return { ...base, issued: false, holder: null, number: null, last4: null, expires: null, cvc: null, status: null, balance_cents: 0, plastic: { status: 'none', method: null, address: null, ordered_at: null } }
    const age = v.orderedAt ? Date.now() - v.orderedAt : 0
    return {
      ...base, issued: true, holder: v.holder,
      number: owner ? v.number : `•••• •••• •••• ${v.number.slice(-4)}`,
      last4: v.number.slice(-4), expires: owner ? v.expires : null, cvc: owner ? v.cvc : null, status: v.status, balance_cents: v.balance,
      plastic: { status: !v.orderedAt ? 'none' : age >= PLASTIC_READY_MS ? 'ready' : 'ordered', method: v.method, address: v.address, ordered_at: v.orderedAt ? new Date(v.orderedAt).toISOString() : null },
    }
  }
  const perm = (childId: number, key: PermissionKey) => !!db.perms[childId]?.[key]
  const permList = (childId: number): Permission[] => {
    const teen = isTeen(user(childId))
    return PERM_KEYS.map((key) => ({
      key, enabled: perm(childId, key),
      // До 14 лет онлайн-покупки и виртуальная карта закрыты (политика пакета, ст. 27 ГК РБ — малолетние совершают только мелкие бытовые сделки)
      locked_reason: (key === 'online_payments' || key === 'virtual_card') && !teen ? 'Доступно с 14 лет' : null,
    }))
  }
  // Следующая выплата карманных: завтра или ближайший понедельник
  const nextAllowanceDate = (period: 'day' | 'week') => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    if (period === 'week') while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  const cashbackFor = (category: Category | null, amount: number) => {
    const c = CASHBACK.find((x) => x.category === category)
    return c ? Math.floor((amount * c.percent) / 100) : 0
  }
  const addTx = (accountId: number, amount: number, merchant: string) =>
    db.txs.push({ id: ++db.seq.tx, account_id: accountId, amount_cents: amount, direction: 'in', category: null, merchant, status: 'approved', decline_reason: null, created_at: new Date().toISOString() })

  const levelOf = (xp: number) => XP_STEPS.reduce((lvl, step, i) => (xp >= step ? i + 1 : lvl), 1)
  const xpToNext = (xp: number) => {
    const l = levelOf(xp)
    return l >= XP_STEPS.length ? 0 : XP_STEPS[l] - xp
  }

  // Начало «сегодня» по местному времени — потрачено за день считаем от него
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }
  const spentToday = (accId: number, category?: Category | null) =>
    db.txs
      .filter((t) => t.account_id === accId && t.direction === 'out' && t.status === 'approved'
        && t.merchant !== 'Перевод на виртуальную карту'   // перевод себе не трата
        && new Date(t.created_at).getTime() >= startOfToday()
        && (category === undefined || t.category === category))
      .reduce((s, t) => s + t.amount_cents, 0)

  const extraToday = (childId: number) =>
    limitExtras.filter((e) => e.childId === childId && e.day === startOfToday()).reduce((s, e) => s + e.extra, 0)

  const generalLimit = (childId: number) =>
    (db.limits[childId] ?? []).find((l) => l.category === null && l.period === 'day' && !l.is_blocked)

  function suggestionFor(childId: number): LevelInfo['suggestion'] {
    const u = user(childId)
    if (levelOf(u.xp) < 3 || db.accepted[childId]) return null
    const blocked = (db.limits[childId] ?? []).some((l) => l.category === 'subscriptions' && l.is_blocked)
    if (!blocked) return null
    return {
      id: `s-${childId}-${levelOf(u.xp)}`,
      text: `${u.name} достиг(ла) уровня ${levelOf(u.xp)}. Разрешить подписки?`,
      action: 'category_unlock',
      category: 'subscriptions',
    }
  }

  // Правила оплаты — тот же порядок, что в плане: первая сработавшая причина = отказ
  function decide(childId: number, a: AccountRow, amount: number, category: Category, online: boolean): { status: 'approved' | 'declined' | 'pending'; reason: DeclineReason | null; text: string } {
    const limits = db.limits[childId] ?? []
    if (a.status === 'blocked') return { status: 'declined', reason: 'card_blocked', text: 'Карта заблокирована родителем' }
    const catBlocked = category === 'adult18' || limits.some((l) => l.category === category && l.is_blocked)
    if (catBlocked) {
      return { status: 'declined', reason: 'category_blocked', text: category === 'adult18' ? 'Категория 18+ запрещена банком' : `Родитель запретил категорию «${CATEGORY_LABEL[category]}»` }
    }
    if (online && !perm(childId, 'online_payments')) return { status: 'declined', reason: 'online_not_allowed', text: 'Онлайн-покупки пока недоступны' }
    if (a.balance_cents < amount) return { status: 'declined', reason: 'insufficient_funds', text: 'На карте не хватает денег' }
    const gl = generalLimit(childId)
    if (gl && spentToday(a.id) + amount > gl.amount_cents + extraToday(childId)) return { status: 'declined', reason: 'limit_exceeded', text: 'Превышен дневной лимит' }
    const catLimit = limits.find((l) => l.category === category && l.period === 'day' && !l.is_blocked && l.amount_cents > 0)
    if (catLimit && spentToday(a.id, category) + amount > catLimit.amount_cents + extraToday(childId)) return { status: 'declined', reason: 'limit_exceeded', text: `Превышен лимит по категории «${CATEGORY_LABEL[category]}»` }
    if (online && amount > 2000) return { status: 'pending', reason: null, text: 'Покупка ждёт подтверждения родителя' }
    return { status: 'approved', reason: null, text: 'Оплата прошла' }
  }

  const api: Api = {
    async login(login) {
      const key = login.trim().toLowerCase()
      if (!key) throw new MockError('validation_error', 'Укажите логин')
      const u = db.users.find((x) => {
        const name = x.name.trim().toLowerCase()
        const first = name.split(/\s+/)[0] ?? ''
        return name === key || first === key
      })
      if (!u) throw new MockError('not_found', 'Пользователь не найден')
      return delay({ id: u.id, role: u.role, name: u.name })
    },

    async getMe() {
      const m = me()
      return delay({ id: m.id, role: m.role, name: m.name, family_id: m.family_id, birth_date: m.birth_date, age_group: ageGroup(m) })
    },

    async getFamily() {
      const p = requireParent()
      const kids = db.users.filter((u) => u.role === 'child' && u.family_id === p.family_id)
      return delay({
        family: { id: p.family_id, name: 'Семья Ивановых', plan: 'basic' },
        children: kids.map((k) => {
          const a = card(k.id)
          return {
            id: k.id, name: k.name, age_group: ageGroup(k),
            card: { id: a.id, last4: a.last4, balance_cents: a.balance_cents, status: a.status },
            pending_requests: db.requests.filter((r) => r.child_id === k.id && r.status === 'pending').length,
            level: levelOf(k.xp),
          }
        }),
      })
    },

    async createPackage(req) {
      const p = requireParent()
      const age = ageFrom(req.child_birth_date)
      if (!req.child_name.trim()) throw new MockError('validation_error', 'Укажите имя ребёнка')
      if (age < 7 || age > 17) throw new MockError('validation_error', 'Пакет выпускается для детей 7–17 лет')
      const need = ['card_issue', 'moby_access', 'personal_data', ...(age >= 14 ? ['teen_info_sharing'] : [])]
      if (!need.every((c) => req.consents.includes(c as never))) throw new MockError('validation_error', 'Не все обязательные согласия получены')
      if (age < 14 && req.consents.includes('online_payments')) throw new MockError('validation_error', 'Онлайн-платежи доступны с 14 лет')
      const id = ++db.seq.user
      const accId = ++db.seq.acc
      db.users.push({ id, role: 'child', name: req.child_name.trim(), family_id: p.family_id, birth_date: req.child_birth_date, xp: 0, points: 0 })
      db.accounts.push({ id: accId, owner_id: id, last4: String(1000 + Math.floor(Math.random() * 9000)), balance_cents: 0, status: 'active' })
      db.limits[id] = [
        { category: null, period: 'day', amount_cents: 1000, is_blocked: false },
        { category: 'games', period: 'day', amount_cents: 0, is_blocked: true },
      ]
      db.perms[id] = defaultPerms(age >= 14, req.consents.includes('online_payments'))
      db.allowance[id] = { amount_cents: 0, period: 'week', active: false }
      return delay({ child_id: id, card_id: accId, age_group: age >= 14 ? '14-17' : '7-13', consents: req.consents })
    },

    async getChild(id) {
      const c = access(id)
      const a = card(id)
      const gl = generalLimit(id)
      const spent = spentToday(a.id)
      return delay({
        id: c.id, name: c.name, age_group: ageGroup(c),
        card: { id: a.id, last4: a.last4, balance_cents: a.balance_cents, status: a.status },
        limits_today: { limit_cents: gl ? gl.amount_cents + extraToday(id) : null, spent_cents: spent, left_cents: gl ? Math.max(0, gl.amount_cents + extraToday(id) - spent) : null },
        level: { level: levelOf(c.xp), xp: c.xp, xp_to_next: xpToNext(c.xp) },
        permissions: { online_payments: perm(id, 'online_payments') },
      })
    },

    async topup(childId, amount) {
      requireParent(); access(childId)
      if (!(amount > 0)) throw new MockError('validation_error', 'Сумма должна быть больше нуля')
      const a = card(childId)
      a.balance_cents += amount
      db.txs.push({ id: ++db.seq.tx, account_id: a.id, amount_cents: amount, direction: 'in', category: null, merchant: 'Пополнение от родителя', status: 'approved', decline_reason: null, created_at: new Date().toISOString() })
      return delay({ balance_cents: a.balance_cents })
    },

    async blockCard(id) { requireParent(); const a = cardById(id); access(a.owner_id); a.status = 'blocked'; return delay({ id, status: 'blocked' }) },
    async unblockCard(id) { requireParent(); const a = cardById(id); access(a.owner_id); a.status = 'active'; return delay({ id, status: 'active' }) },

    async getLimits(childId) { access(childId); return delay({ items: db.limits[childId] ?? [] }) },

    async putLimits(childId, items) {
      requireParent(); access(childId)
      if (items.some((i) => i.category === 'adult18' && !i.is_blocked)) throw new MockError('forbidden', 'Категорию 18+ нельзя открыть: она запрещена банком')
      db.limits[childId] = items.map((i, n) => ({ ...i, id: n + 1 }))
      return delay({ items: db.limits[childId] })
    },

    async simulatePayment(req) {
      const c = requireChild()
      const a = cardById(req.card_id)
      if (a.owner_id !== c.id) throw new MockError('forbidden', 'Это не ваша карта')
      const d = decide(c.id, a, req.amount_cents, req.category, req.is_online)
      if (d.status === 'approved') { a.balance_cents -= req.amount_cents; c.points += cashbackFor(req.category, req.amount_cents) }
      const id = ++db.seq.tx
      db.txs.push({ id, account_id: a.id, amount_cents: req.amount_cents, direction: 'out', category: req.category, merchant: req.merchant, status: d.status, decline_reason: d.reason, created_at: new Date().toISOString() })
      const res: PayResult = { transaction_id: id, status: d.status, decline_reason: d.reason, balance_cents: a.balance_cents, message: d.text }
      return delay(res)
    },

    async getTransactions(childId, limit = 20) {
      access(childId)
      const a = card(childId)
      const items = db.txs.filter((t) => t.account_id === a.id).sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, limit)
        .map(({ account_id: _a, ...t }) => t)
      return delay({ items })
    },

    async createRequest(req) {
      const c = requireChild()
      const row: ReqRow = {
        id: ++db.seq.req, child_id: c.id, child_name: c.name, type: req.type,
        amount_cents: req.amount_cents ?? null, category: req.category ?? null, permission: req.permission ?? null,
        comment: req.comment, status: 'pending', created_at: new Date().toISOString(),
      }
      db.requests.push(row)
      return delay({ id: row.id, status: 'pending' })
    },

    async listRequests(status?: ReqStatus) {
      const m = me()
      const items = db.requests
        .filter((r) => (m.role === 'parent' ? user(r.child_id).family_id === m.family_id : r.child_id === m.id))
        .filter((r) => !status || r.status === status)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
      return delay({ items })
    },

    async approveRequest(id) {
      requireParent()
      const r = db.requests.find((x) => x.id === id)
      if (!r) throw new MockError('not_found', 'Запрос не найден')
      access(r.child_id)
      if (r.status !== 'pending') throw new MockError('conflict', 'Запрос уже обработан')
      // Одобрение сразу применяет эффект запроса
      if (r.type === 'money' && r.amount_cents) {
        const a = card(r.child_id)
        a.balance_cents += r.amount_cents
        db.txs.push({ id: ++db.seq.tx, account_id: a.id, amount_cents: r.amount_cents, direction: 'in', category: null, merchant: 'По запросу ребёнка', status: 'approved', decline_reason: null, created_at: new Date().toISOString() })
      } else if (r.type === 'limit_once' && r.amount_cents) {
        limitExtras.push({ childId: r.child_id, extra: r.amount_cents, day: startOfToday() })
      } else if (r.type === 'limit_increase' && r.amount_cents) {
        const list = db.limits[r.child_id] ?? (db.limits[r.child_id] = [])
        const g = list.find((l) => l.category === null && l.period === 'day')
        if (g) g.amount_cents = r.amount_cents
        else list.push({ category: null, period: 'day', amount_cents: r.amount_cents, is_blocked: false })
      } else if (r.type === 'product_access' && r.permission) {
        const locked = permList(r.child_id).find((x) => x.key === r.permission)?.locked_reason
        if (locked) throw new MockError('forbidden', `Нельзя включить: ${locked.toLowerCase()}`)
        db.perms[r.child_id] = { ...db.perms[r.child_id], [r.permission]: true }
      } else if (r.type === 'category_unlock' && r.category && r.category !== 'adult18') {
        db.limits[r.child_id] = (db.limits[r.child_id] ?? []).filter((l) => l.category !== r.category)
      }
      r.status = 'approved'
      return delay({ id, status: 'approved' })
    },

    async rejectRequest(id) {
      requireParent()
      const r = db.requests.find((x) => x.id === id)
      if (!r) throw new MockError('not_found', 'Запрос не найден')
      access(r.child_id)
      r.status = 'rejected'
      return delay({ id, status: 'rejected' })
    },

    async createGoal(title, target) {
      const c = requireChild()
      if (!perm(c.id, 'goals')) throw new MockError('forbidden', 'Цели выключены родителем — попроси доступ')
      if (!title.trim() || !(target > 0)) throw new MockError('validation_error', 'Укажите название и сумму цели')
      const g = { id: ++db.seq.goal, child_id: c.id, title: title.trim(), target_cents: target, saved_cents: 0, parent_bonus_percent: 0, status: 'active' as const }
      db.goals.push(g)
      const { child_id: _c, ...pub } = g
      return delay(pub)
    },

    async getGoals(childId) {
      access(childId)
      return delay({
        items: db.goals.filter((g) => g.child_id === childId).map(({ child_id: _c, ...g }) => g),
      })
    },

    async depositGoal(id, amount) {
      const c = requireChild()
      const g = db.goals.find((x) => x.id === id && x.child_id === c.id)
      if (!g) throw new MockError('not_found', 'Цель не найдена')
      const a = card(c.id)
      if (!(amount > 0)) throw new MockError('validation_error', 'Сумма должна быть больше нуля')
      if (a.balance_cents < amount) throw new MockError('validation_error', 'На карте не хватает денег')
      // Бонус родителя: процент от взноса, без ограничения по сумме
      const bonus = Math.floor((amount * g.parent_bonus_percent) / 100)
      // Бонус к взносу больше 10 BYN ждёт подтверждения родителя, обычный начисляется сразу
      const needsConfirm = bonus > 0 && amount > BONUS_CONFIRM_DEPOSIT
      const credited = needsConfirm ? 0 : bonus
      a.balance_cents -= amount
      g.saved_cents += amount + credited
      g.bonus_cents = (g.bonus_cents ?? 0) + credited
      if (needsConfirm) db.bonuses.push({ id: ++db.seq.bonus, child_id: c.id, goal_id: g.id, amount_cents: bonus, status: 'pending', created_at: new Date().toISOString() })
      if (g.saved_cents >= g.target_cents) g.status = 'done'
      return delay({ saved_cents: g.saved_cents, card_balance_cents: a.balance_cents, bonus_cents: credited, bonus_pending_cents: needsConfirm ? bonus : 0, status: g.status })
    },

    async listPendingBonuses() {
      const m = requireParent()
      const items = db.bonuses
        .filter((b) => b.status === 'pending' && user(b.child_id).family_id === m.family_id)
        .map((b) => ({ id: b.id, child_id: b.child_id, child_name: user(b.child_id).name, goal_title: db.goals.find((g) => g.id === b.goal_id)?.title ?? '', amount_cents: b.amount_cents, created_at: b.created_at }))
      return delay({ items })
    },

    async approveBonus(id) { return decideBonus(id, true) },
    async rejectBonus(id) { return decideBonus(id, false) },

    async withdrawGoal(id, amount) {
      requireParent()
      const g = db.goals.find((x) => x.id === id)
      if (!g) throw new MockError('not_found', 'Цель не найдена')
      access(g.child_id)
      if (!(amount > 0)) throw new MockError('validation_error', 'Сумма должна быть больше нуля')
      if (amount > g.saved_cents) throw new MockError('validation_error', 'В копилке меньше денег, чем вы хотите снять')
      const a = card(g.child_id)
      g.saved_cents -= amount
      if (g.status === 'done' && g.saved_cents < g.target_cents) g.status = 'active'
      a.balance_cents += amount
      db.txs.push({ id: ++db.seq.tx, account_id: a.id, amount_cents: amount, direction: 'in', category: null, merchant: `Из копилки «${g.title}»`, status: 'approved', decline_reason: null, created_at: new Date().toISOString() })
      return delay({ saved_cents: g.saved_cents, card_balance_cents: a.balance_cents, withdrawn_cents: amount, status: g.status })
    },

    async setGoalBonus(id, percent) {
      requireParent()
      const g = db.goals.find((x) => x.id === id)
      if (!g) throw new MockError('not_found', 'Цель не найдена')
      access(g.child_id)
      g.parent_bonus_percent = percent
      return delay({ parent_bonus_percent: percent })
    },

    async createTask(req) {
      requireParent(); access(req.assigned_to)
      if (!req.title.trim()) throw new MockError('validation_error', 'Укажите задание')
      const t: Task = { id: ++db.seq.task, assigned_to: req.assigned_to, title: req.title.trim(), reward_cents: req.reward_cents, xp_reward: req.xp_reward, status: 'new', due_date: req.due_date ?? null }
      db.tasks.push(t)
      return delay({ id: t.id, status: 'new' })
    },

    async listTasks(childId) {
      const m = me()
      const items = db.tasks.filter((t) => {
        if (m.role === 'child') return t.assigned_to === m.id
        const owner = user(t.assigned_to)
        return owner.family_id === m.family_id && (!childId || t.assigned_to === childId)
      })
      return delay({ items })
    },

    async taskDone(id) {
      const c = requireChild()
      const t = db.tasks.find((x) => x.id === id && x.assigned_to === c.id)
      if (!t) throw new MockError('not_found', 'Задание не найдено')
      t.status = 'done'
      return delay({ id, status: 'done' })
    },

    async taskConfirm(id) {
      requireParent()
      const t = db.tasks.find((x) => x.id === id)
      if (!t) throw new MockError('not_found', 'Задание не найдено')
      const c = access(t.assigned_to)
      if (t.status !== 'done') throw new MockError('conflict', 'Задание ещё не выполнено')
      t.status = 'confirmed'
      // Награду платит родитель; банк даёт ребёнку опыт
      const a = card(c.id)
      a.balance_cents += t.reward_cents
      db.txs.push({ id: ++db.seq.tx, account_id: a.id, amount_cents: t.reward_cents, direction: 'in', category: null, merchant: `За задание: ${t.title}`, status: 'approved', decline_reason: null, created_at: new Date().toISOString() })
      c.xp += t.xp_reward
      return delay({ id, status: 'confirmed', balance_cents: a.balance_cents, xp: c.xp, level: levelOf(c.xp) })
    },

    async taskReject(id) {
      requireParent()
      const t = db.tasks.find((x) => x.id === id)
      if (!t) throw new MockError('not_found', 'Задание не найдено')
      access(t.assigned_to)
      t.status = 'rejected'
      return delay({ id, status: 'rejected' })
    },

    async getLevel(childId) {
      const c = access(childId)
      const l = levelOf(c.xp)
      return delay({
        level: l, xp: c.xp, xp_to_next: xpToNext(c.xp),
        unlocked: UNLOCKS.slice(0, l).flat(),
        next_unlocks: l < UNLOCKS.length ? UNLOCKS[l] : [],
        suggestion: suggestionFor(childId),
      })
    },

    async acceptSuggestion(childId) {
      requireParent(); access(childId)
      const s = suggestionFor(childId)
      if (!s) return delay({ applied: false })
      // Применяем: снимаем запрет подписок
      db.limits[childId] = (db.limits[childId] ?? []).filter((l) => l.category !== 'subscriptions')
      db.accepted[childId] = true
      return delay({ applied: true })
    },

    async demoReset() { db = seed(); beavers = {}; vcards = {}; limitExtras = []; return delay({ status: 'ok' }) },

    // ───────── Виртуальная карта ─────────
    async getVirtualCard(childId) { access(childId); return delay(vcardView(childId)) },

    async issueVirtualCard(childId, holder) {
      const c = requireChild()
      if (c.id !== childId) throw new MockError('forbidden', 'Нет доступа к профилю другого пользователя')
      const v = vcardView(childId)
      if (!v.available) throw new MockError('forbidden', v.locked_reason ?? 'Виртуальная карта недоступна')
      if (!vcards[childId]) {
        const name = (holder ?? c.name).trim().replace(/\s+/g, ' ').toUpperCase().slice(0, 26)
        if (name.length < 2) throw new MockError('validation_error', 'Укажите имя на карте')
        const now = new Date()
        vcards[childId] = {
          holder: name, number: luhnNumber(), cvc: String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
          expires: `${String(now.getMonth() + 1).padStart(2, '0')}/${String((now.getFullYear() + 4) % 100).padStart(2, '0')}`,
          status: 'active', balance: 0, method: null, address: null, orderedAt: null,
        }
      }
      return delay(vcardView(childId))
    },

    async setVirtualCardStatus(childId, status) {
      access(childId)
      if (!vcards[childId]) throw new MockError('not_found', 'Виртуальная карта ещё не выпущена')
      vcards[childId].status = status
      return delay(vcardView(childId))
    },

    async transferVirtualCard(childId, direction, amountCents) {
      const c = requireChild()
      if (c.id !== childId) throw new MockError('forbidden', 'Нет доступа к профилю другого пользователя')
      const v = vcards[childId]
      if (!v) throw new MockError('not_found', 'Сначала выпустите виртуальную карту')
      if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 1_000_000) throw new MockError('validation_error', 'Укажите сумму перевода')
      const a = card(childId)
      if (a.status === 'blocked') throw new MockError('card_blocked', 'Карта заблокирована')
      const row = { id: ++db.seq.tx, account_id: a.id, amount_cents: amountCents, category: null, status: 'approved' as const, decline_reason: null, created_at: new Date().toISOString() }
      if (direction === 'to_card') {
        if (a.balance_cents < amountCents) throw new MockError('insufficient_funds', `На счёте не хватает денег: доступно ${rub(a.balance_cents)}`)
        a.balance_cents -= amountCents; v.balance += amountCents
        db.txs.push({ ...row, direction: 'out', merchant: 'Перевод на виртуальную карту' })
      } else {
        if (v.balance < amountCents) throw new MockError('insufficient_funds', `На карте не хватает денег: доступно ${rub(v.balance)}`)
        v.balance -= amountCents; a.balance_cents += amountCents
        db.txs.push({ ...row, direction: 'in', merchant: 'Перевод с виртуальной карты' })
      }
      return delay(vcardView(childId))
    },

    async orderPlastic(childId, method, address) {
      const c = requireChild()
      if (c.id !== childId) throw new MockError('forbidden', 'Нет доступа к профилю другого пользователя')
      const v = vcards[childId]
      if (!v) throw new MockError('not_found', 'Сначала выпустите виртуальную карту')
      if (v.orderedAt) throw new MockError('conflict', 'Пластиковая карта уже заказана')
      if (method === 'delivery' && (address ?? '').trim().length < 5) throw new MockError('validation_error', 'Укажите адрес доставки')
      const price = PLASTIC_PRICE + (method === 'delivery' ? COURIER_FEE : 0)
      const a = card(childId)
      if (a.status === 'blocked') throw new MockError('card_blocked', 'Карта заблокирована')
      if (a.balance_cents < price) throw new MockError('insufficient_funds', `На карте не хватает денег: нужно ${rub(price)}`)
      a.balance_cents -= price
      db.txs.push({ id: ++db.seq.tx, account_id: a.id, amount_cents: price, direction: 'out', category: null, merchant: 'МТБанк · пластиковая карта', status: 'approved', decline_reason: null, created_at: new Date().toISOString() })
      v.method = method; v.address = method === 'delivery' ? (address ?? '').trim() : null; v.orderedAt = Date.now()
      return delay(vcardView(childId))
    },

    async getBeaver(childId) {
      const b = beavers[childId]
      return delay(b ? { data: b.data, updated_at: b.updated_at } : { data: null, updated_at: 0 })
    },
    async putBeaver(childId, data, updatedAt) {
      const cur = beavers[childId]
      if (!cur || cur.updated_at <= updatedAt) beavers[childId] = { data, updated_at: updatedAt }
      const b = beavers[childId]
      return delay({ data: b.data, updated_at: b.updated_at })
    },

    // ───────── Подтверждение покупок ─────────
    async listPendingPurchases() {
      const m = me()
      const items = db.txs
        .filter((t) => t.status === 'pending' && t.direction === 'out')
        .map((t) => ({ t, owner: user(db.accounts.find((a) => a.id === t.account_id)!.owner_id) }))
        .filter(({ owner }) => (m.role === 'parent' ? owner.family_id === m.family_id : owner.id === m.id))
        .sort((x, y) => y.t.created_at.localeCompare(x.t.created_at))
        .map(({ t, owner }) => { const { account_id: _a, ...rest } = t; return { ...rest, child_id: owner.id, child_name: owner.name } })
      return delay({ items })
    },

    async approvePurchase(id) {
      requireParent()
      const t = db.txs.find((x) => x.id === id)
      if (!t) throw new MockError('not_found', 'Операция не найдена')
      const a = cardById(t.account_id)
      const child = access(a.owner_id)
      if (t.status !== 'pending') throw new MockError('conflict', 'Операция уже обработана')
      // На момент подтверждения деньги могли закончиться или карту заблокировали
      if (a.status === 'blocked') { t.status = 'declined'; t.decline_reason = 'card_blocked'; return delay({ id, status: t.status, balance_cents: a.balance_cents, message: 'Карта заблокирована, покупка отклонена' }) }
      if (a.balance_cents < t.amount_cents) { t.status = 'declined'; t.decline_reason = 'insufficient_funds'; return delay({ id, status: t.status, balance_cents: a.balance_cents, message: 'На карте не хватает денег, покупка отклонена' }) }
      a.balance_cents -= t.amount_cents
      child.points += cashbackFor(t.category, t.amount_cents)
      t.status = 'approved'
      return delay({ id, status: t.status, balance_cents: a.balance_cents, message: 'Покупка подтверждена' })
    },

    async declinePurchase(id) {
      requireParent()
      const t = db.txs.find((x) => x.id === id)
      if (!t) throw new MockError('not_found', 'Операция не найдена')
      const a = cardById(t.account_id)
      access(a.owner_id)
      if (t.status !== 'pending') throw new MockError('conflict', 'Операция уже обработана')
      t.status = 'declined'
      return delay({ id, status: t.status, balance_cents: a.balance_cents, message: 'Покупка отклонена родителем' })
    },

    // ───────── Карманные деньги ─────────
    async getAllowance(childId) {
      access(childId)
      const al = db.allowance[childId] ?? { amount_cents: 0, period: 'week' as const, active: false }
      return delay({ ...al, next_date: al.active ? nextAllowanceDate(al.period) : null })
    },

    async putAllowance(childId, a) {
      requireParent(); access(childId)
      if (a.active && !(a.amount_cents > 0)) throw new MockError('validation_error', 'Укажите сумму карманных денег')
      db.allowance[childId] = { amount_cents: a.amount_cents, period: a.period, active: a.active }
      return delay({ ...db.allowance[childId], next_date: a.active ? nextAllowanceDate(a.period) : null })
    },

    async payAllowance(childId) {
      requireParent(); access(childId)
      const al = db.allowance[childId]
      if (!al || !al.active || !(al.amount_cents > 0)) throw new MockError('validation_error', 'Карманные деньги не настроены')
      const a = card(childId)
      a.balance_cents += al.amount_cents
      addTx(a.id, al.amount_cents, 'Карманные деньги')
      return delay({ balance_cents: a.balance_cents })
    },

    // ───────── Права ребёнка ─────────
    async getPermissions(childId) { access(childId); return delay({ items: permList(childId) }) },

    async putPermissions(childId, items) {
      requireParent(); access(childId)
      const cur = permList(childId)
      for (const it of items) {
        const lock = cur.find((x) => x.key === it.key)?.locked_reason
        if (it.enabled && lock) throw new MockError('forbidden', `Нельзя включить: ${lock.toLowerCase()}`)
      }
      db.perms[childId] = { ...db.perms[childId], ...Object.fromEntries(items.map((i) => [i.key, i.enabled])) }
      return delay({ items: permList(childId) })
    },

    // ───────── Уроки ─────────
    async getLessons(childId) {
      const m = me()
      const cid = m.role === 'child' ? m.id : childId
      if (!cid) throw new MockError('validation_error', 'Укажите ребёнка')
      access(cid)
      const done = db.lessonsDone[cid] ?? []
      return delay({ items: LESSONS.map(({ answer: _a, explanation: _e, ...l }) => ({ ...l, completed: done.includes(l.id) })) })
    },

    async answerLesson(lessonId, optionIndex) {
      const c = requireChild()
      const l = LESSONS.find((x) => x.id === lessonId)
      if (!l) throw new MockError('not_found', 'Урок не найден')
      const done = db.lessonsDone[c.id] ?? (db.lessonsDone[c.id] = [])
      const correct = optionIndex === l.answer
      // Награда начисляется один раз — за первый правильный ответ
      if (correct && !done.includes(l.id)) {
        done.push(l.id)
        c.xp += l.xp_reward
        c.points += l.points_reward
      }
      return delay({ correct, explanation: correct ? l.explanation : 'Не совсем. Перечитай урок и попробуй ещё раз.', xp: c.xp, level: levelOf(c.xp), points: c.points })
    },

    // ───────── Лояльность ─────────
    async getLoyalty(childId) {
      const m = me()
      const target = m.role === 'parent' && childId ? access(childId) : m
      const audience = target.role === 'parent' ? ['parent', 'family'] : ['child', 'family']
      const offersOn = target.role === 'parent' || perm(target.id, 'partner_offers')
      return delay({ points: target.points, cashback: CASHBACK, offers: offersOn ? OFFERS.filter((o) => audience.includes(o.audience)) : [] })
    },

    async redeemOffer(offerId) {
      const m = me()
      const o = OFFERS.find((x) => x.id === offerId)
      if (!o) throw new MockError('not_found', 'Предложение не найдено')
      if (m.role === 'child' && !perm(m.id, 'partner_offers')) throw new MockError('forbidden', 'Предложения партнёров выключены родителем')
      if (m.points < o.points_cost) throw new MockError('validation_error', 'Не хватает баллов')
      m.points -= o.points_cost
      return delay({ points: m.points, code: `MT-${o.id}${Math.floor(1000 + Math.random() * 9000)}` })
    },

    // ───────── Потеря карты ─────────
    async reissueCard(cardId) {
      requireParent()
      const a = cardById(cardId)
      access(a.owner_id)
      a.last4 = String(1000 + Math.floor(Math.random() * 9000))
      a.status = 'active'
      return delay({ id: a.id, last4: a.last4, status: a.status })
    },
  }

  return api
}

// Ошибки mock выглядят как ошибки настоящего клиента: у них есть message для показа
export type { MockError }
