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
export type ReqType = 'money' | 'limit_increase' | 'category_unlock'
export type ReqStatus = 'pending' | 'approved' | 'rejected'
export type TaskStatus = 'new' | 'done' | 'confirmed' | 'rejected'
export type ConsentType = 'card_issue' | 'moby_access' | 'online_payments'

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
  status: 'active' | 'done'
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
