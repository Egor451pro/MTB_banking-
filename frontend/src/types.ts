// Типы повторяют docs/api.md. Если контракт меняется — меняем здесь и в api.md одновременно.

export type Role = 'parent' | 'child'
export type AgeGroup = '7-13' | '14-17'
export type Category =
  | 'food' | 'transport' | 'games' | 'subscriptions'
  | 'shopping' | 'entertainment' | 'education' | 'adult18'
export type Period = 'day' | 'week' | 'month'
export type DeclineReason =
  | 'card_blocked' | 'category_blocked' | 'online_not_allowed'
  | 'insufficient_funds' | 'limit_exceeded'
export type TxStatus = 'approved' | 'declined' | 'pending'
export type ReqType = 'money' | 'limit_increase' | 'limit_once' | 'category_unlock' | 'product_access'
export type ReqStatus = 'pending' | 'approved' | 'rejected'
export type TaskStatus = 'new' | 'done' | 'confirmed' | 'rejected'
// personal_data — обработка персональных данных ребёнка (Закон РБ № 99-З, до 16 лет согласие даёт законный представитель)
// teen_info_sharing — согласие подростка 14–17 лет, что родитель видит его операции (подросток — владелец счёта)
export type ConsentType = 'card_issue' | 'moby_access' | 'personal_data' | 'teen_info_sharing' | 'online_payments'

export interface Me {
  id: number
  role: Role
  name: string
  family_id: number
  birth_date: string
  age_group: AgeGroup
}

export interface Card {
  id: number
  last4: string
  balance_cents: number
  status: 'active' | 'blocked'
}

export interface ChildSummary {
  id: number
  name: string
  age_group: AgeGroup
  card: Card
  pending_requests: number
  level: number
}

export interface FamilyResp {
  family: { id: number; name: string; plan: string }
  children: ChildSummary[]
}

export interface ChildDetail {
  id: number
  name: string
  age_group: AgeGroup
  card: Card
  limits_today: { limit_cents: number | null; spent_cents: number; left_cents: number | null }
  level: { level: number; xp: number; xp_to_next: number }
  permissions: { online_payments: boolean }
}

export interface LimitItem {
  id?: number
  category: Category | null // null = общий лимит на все траты
  period: Period
  amount_cents: number
  is_blocked: boolean
}

export interface PayRequest {
  card_id: number
  amount_cents: number
  category: Category
  merchant: string
  is_online: boolean
}

export interface PayResult {
  transaction_id: number
  status: TxStatus
  decline_reason: DeclineReason | null
  balance_cents: number
  message: string
}

export interface Transaction {
  id: number
  amount_cents: number
  direction: 'in' | 'out'
  category: Category | null
  merchant: string
  status: TxStatus
  decline_reason: DeclineReason | null
  created_at: string
}

export interface AccessRequest {
  id: number
  child_id: number
  child_name: string
  type: ReqType
  amount_cents: number | null
  category: Category | null
  permission?: PermissionKey | null // для product_access
  comment: string
  status: ReqStatus
  created_at: string
}

export interface Goal {
  id: number
  title: string
  target_cents: number
  saved_cents: number
  parent_bonus_percent: number
  bonus_cents?: number   // сколько бонуса родителя уже вошло в накопления
  status: 'active' | 'done'
}

// Результат взноса в цель: бонус родителя начисляется сразу, но не больше месячного лимита
export interface DepositResult {
  saved_cents: number
  card_balance_cents: number
  bonus_cents: number        // бонус за этот взнос, уже начисленный
  bonus_pending_cents: number // бонус к взносу больше 10 BYN ждёт подтверждения родителя
  status: string
}

// Крупный бонус, который родитель должен подтвердить
export interface PendingBonus {
  id: number
  child_id: number
  child_name: string
  goal_title: string
  amount_cents: number
  created_at: string
}

export interface BonusDecision {
  id: number
  status: 'credited' | 'rejected'
  saved_cents: number
}

// Родитель снимает деньги с копилки ребёнка: они возвращаются на карту ребёнка
export interface WithdrawResult {
  saved_cents: number
  card_balance_cents: number
  withdrawn_cents: number
  status: 'active' | 'done'
}

export interface GoalsResp {
  items: Goal[]
}

export interface Task {
  id: number
  assigned_to: number
  title: string
  reward_cents: number
  xp_reward: number
  status: TaskStatus
  due_date: string | null
}

export interface LevelInfo {
  level: number
  xp: number
  xp_to_next: number
  unlocked: string[]
  next_unlocks: string[]
  suggestion: { id: string; text: string; action: string; category?: Category } | null
}

export interface PackageReq {
  child_name: string
  child_birth_date: string
  consents: ConsentType[]
}

// ───────── Дополнение к контракту: функции из ТЗ ─────────

// Права ребёнка в Moby: какие продукты он может оформлять, каким функционалом пользоваться
export type PermissionKey = 'online_payments' | 'goals' | 'virtual_card' | 'savings' | 'partner_offers'
export interface VirtualCard {
  available: boolean                 // можно ли выпустить и пользоваться
  locked_reason: string | null       // почему нельзя (возраст, нет разрешения родителя)
  issued: boolean
  holder: string | null
  number: string | null              // полностью только у владельца, у родителя с маской
  last4: string | null
  expires: string | null
  cvc: string | null
  status: 'active' | 'frozen' | null
  balance_cents: number              // свой баланс карты
  plastic: { status: 'none' | 'ordered' | 'ready'; method: 'pickup' | 'delivery' | null; address: string | null; ordered_at: string | null }
  plastic_price_cents: number
  courier_fee_cents: number
}

export interface Permission {
  key: PermissionKey
  enabled: boolean
  locked_reason: string | null // не null — право нельзя включить (например, по возрасту)
}

// Покупка, которая ждёт подтверждения родителя (крупная онлайн-покупка)
export interface PendingPurchase extends Transaction {
  child_id: number
  child_name: string
}

export interface ApproveResult {
  id: number
  status: TxStatus
  balance_cents: number
  message: string
}

// Карманные деньги: регулярный перевод от родителя
export interface Allowance {
  amount_cents: number
  period: 'day' | 'week'
  active: boolean
  next_date: string | null // YYYY-MM-DD
}

// Урок финансовой грамотности
export interface Lesson {
  id: number
  title: string
  description: string
  content: string[]
  question: string
  options: string[]
  xp_reward: number
  points_reward: number
  completed: boolean
}

export interface LessonResult {
  correct: boolean
  explanation: string
  xp: number
  level: number
  points: number
}

// Программа лояльности: баллы (1 балл = 1 копейка) и предложения партнёров
export interface Offer {
  id: number
  partner: string
  title: string
  description: string
  audience: 'child' | 'parent' | 'family'
  points_cost: number
}

export interface LoyaltyInfo {
  points: number
  cashback: { category: Category; percent: number }[]
  offers: Offer[]
}
