import type { Api } from './index'
import { session } from './index'
import type {
  AccessRequest, AgeGroup, Category, DeclineReason, Goal, LevelInfo, LimitItem,
  PayResult, ReqStatus, Task, Transaction,
} from '../types'
import { ageFrom, CATEGORY_LABEL } from '../format'

// Mock = «бэкенд в браузере». Те же эндпоинты и формы ответов, что в docs/api.md,
// плюс те же правила оплаты, что будут в services/payment_rules.py. Данные живут в памяти:
// перезагрузка страницы возвращает демо-семью (аналог POST /demo/reset).

interface UserRow {
  id: number; role: 'parent' | 'child'; name: string; family_id: number
  birth_date: string; xp: number
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
  online: Record<number, boolean>      // разрешены ли онлайн-платежи
  accepted: Record<number, boolean>    // принято ли предложение уровня
  seq: { tx: number; req: number; goal: number; task: number; user: number; acc: number }
}

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
      { id: 1, role: 'parent', name: 'Мама', family_id: 1, birth_date: '1988-04-10', xp: 0 },
      { id: 2, role: 'child', name: 'Миша', family_id: 1, birth_date: '2016-03-02', xp: 100 },
      { id: 3, role: 'child', name: 'Аня', family_id: 1, birth_date: '2011-06-20', xp: 260 },
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
    online: { 2: false, 3: true },
    accepted: {},
    seq: { tx: 5, req: 1, goal: 1, task: 2, user: 3, acc: 11 },
  }
}

class MockError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}

export function mockApi(): Api {
  let db = seed()

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
        && new Date(t.created_at).getTime() >= startOfToday()
        && (category === undefined || t.category === category))
      .reduce((s, t) => s + t.amount_cents, 0)

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
    if (online && !db.online[childId]) return { status: 'declined', reason: 'online_not_allowed', text: 'Онлайн-покупки пока недоступны' }
    if (a.balance_cents < amount) return { status: 'declined', reason: 'insufficient_funds', text: 'На карте не хватает денег' }
    const gl = generalLimit(childId)
    if (gl && spentToday(a.id) + amount > gl.amount_cents) return { status: 'declined', reason: 'limit_exceeded', text: 'Превышен дневной лимит' }
    const catLimit = limits.find((l) => l.category === category && l.period === 'day' && !l.is_blocked && l.amount_cents > 0)
    if (catLimit && spentToday(a.id, category) + amount > catLimit.amount_cents) return { status: 'declined', reason: 'limit_exceeded', text: `Превышен лимит по категории «${CATEGORY_LABEL[category]}»` }
    if (online && amount > 2000) return { status: 'pending', reason: null, text: 'Покупка ждёт подтверждения родителя' }
    return { status: 'approved', reason: null, text: 'Оплата прошла' }
  }

  const api: Api = {
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
      const id = ++db.seq.user
      const accId = ++db.seq.acc
      db.users.push({ id, role: 'child', name: req.child_name.trim(), family_id: p.family_id, birth_date: req.child_birth_date, xp: 0 })
      db.accounts.push({ id: accId, owner_id: id, last4: String(1000 + Math.floor(Math.random() * 9000)), balance_cents: 0, status: 'active' })
      db.limits[id] = [
        { category: null, period: 'day', amount_cents: 1000, is_blocked: false },
        { category: 'games', period: 'day', amount_cents: 0, is_blocked: true },
      ]
      db.online[id] = age >= 14 && req.consents.includes('online_payments')
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
        limits_today: { limit_cents: gl ? gl.amount_cents : null, spent_cents: spent, left_cents: gl ? Math.max(0, gl.amount_cents - spent) : null },
        level: { level: levelOf(c.xp), xp: c.xp, xp_to_next: xpToNext(c.xp) },
        permissions: { online_payments: !!db.online[id] },
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
      if (d.status === 'approved') a.balance_cents -= req.amount_cents
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
        amount_cents: req.amount_cents ?? null, category: req.category ?? null,
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
      } else if (r.type === 'limit_increase' && r.amount_cents) {
        const list = db.limits[r.child_id] ?? (db.limits[r.child_id] = [])
        const g = list.find((l) => l.category === null && l.period === 'day')
        if (g) g.amount_cents = r.amount_cents
        else list.push({ category: null, period: 'day', amount_cents: r.amount_cents, is_blocked: false })
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
      if (!title.trim() || !(target > 0)) throw new MockError('validation_error', 'Укажите название и сумму цели')
      const g = { id: ++db.seq.goal, child_id: c.id, title: title.trim(), target_cents: target, saved_cents: 0, parent_bonus_percent: 0, status: 'active' as const }
      db.goals.push(g)
      const { child_id: _c, ...pub } = g
      return delay(pub)
    },

    async getGoals(childId) {
      access(childId)
      return delay({ items: db.goals.filter((g) => g.child_id === childId).map(({ child_id: _c, ...g }) => g) })
    },

    async depositGoal(id, amount) {
      const c = requireChild()
      const g = db.goals.find((x) => x.id === id && x.child_id === c.id)
      if (!g) throw new MockError('not_found', 'Цель не найдена')
      const a = card(c.id)
      if (!(amount > 0)) throw new MockError('validation_error', 'Сумма должна быть больше нуля')
      if (a.balance_cents < amount) throw new MockError('validation_error', 'На карте не хватает денег')
      a.balance_cents -= amount
      g.saved_cents += amount
      if (g.saved_cents >= g.target_cents) g.status = 'done'
      return delay({ saved_cents: g.saved_cents, card_balance_cents: a.balance_cents, status: g.status })
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

    async demoReset() { db = seed(); return delay({ status: 'ok' }) },
  }

  return api
}

// Ошибки mock выглядят как ошибки настоящего клиента: у них есть message для показа
export type { MockError }
