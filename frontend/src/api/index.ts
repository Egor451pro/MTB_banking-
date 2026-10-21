import type {
  AccessRequest, Allowance, ApproveResult, Category, ChildDetail, DepositResult, FamilyResp, Goal, GoalsResp, Lesson, LessonResult,
  LevelInfo, WithdrawResult, LimitItem, LoyaltyInfo, Me, PackageReq, PayRequest, PayResult, PendingPurchase, PendingBonus, BonusDecision, Permission,
  PermissionKey, ReqStatus, ReqType, Task, Transaction, VirtualCard,
} from '../types'
import { realApi } from './real'
import { mockApi } from './mock'

// Текущий пользователь после демо-входа. Клиент шлёт его как X-User-Id.
export const session = { userId: 0 }
export { demoLink } from './demoSession'

export type BeaverSave = { data: Record<string, unknown> | null; updated_at: number }

export type LoginResult = { id: number; role: 'parent' | 'child'; name: string }

// Один интерфейс для настоящего API и для mock: экраны не знают, что за ним стоит.
export interface Api {
  login(login: string): Promise<LoginResult>
  getMe(): Promise<Me>
  getFamily(): Promise<FamilyResp>
  createPackage(req: PackageReq): Promise<{ child_id: number; card_id: number; age_group: string; consents: string[] }>
  getChild(id: number): Promise<ChildDetail>
  topup(childId: number, amountCents: number): Promise<{ balance_cents: number }>
  blockCard(cardId: number): Promise<{ id: number; status: string }>
  unblockCard(cardId: number): Promise<{ id: number; status: string }>
  getLimits(childId: number): Promise<{ items: LimitItem[] }>
  putLimits(childId: number, items: LimitItem[]): Promise<{ items: LimitItem[] }>
  simulatePayment(req: PayRequest): Promise<PayResult>
  getTransactions(childId: number, limit?: number): Promise<{ items: Transaction[] }>
  createRequest(req: { type: ReqType; amount_cents?: number; category?: Category; permission?: PermissionKey; comment: string }): Promise<{ id: number; status: string }>
  listRequests(status?: ReqStatus): Promise<{ items: AccessRequest[] }>
  approveRequest(id: number): Promise<{ id: number; status: string }>
  rejectRequest(id: number): Promise<{ id: number; status: string }>
  createGoal(title: string, targetCents: number): Promise<Goal>
  getGoals(childId: number): Promise<GoalsResp>
  depositGoal(id: number, amountCents: number): Promise<DepositResult>
  setGoalBonus(id: number, percent: number): Promise<{ parent_bonus_percent: number }>
  withdrawGoal(id: number, amountCents: number): Promise<WithdrawResult>
  createTask(req: { assigned_to: number; title: string; reward_cents: number; xp_reward: number; due_date?: string }): Promise<{ id: number; status: string }>
  listTasks(childId?: number): Promise<{ items: Task[] }>
  taskDone(id: number): Promise<{ id: number; status: string }>
  taskConfirm(id: number): Promise<{ id: number; status: string; balance_cents: number; xp: number; level: number }>
  taskReject(id: number): Promise<{ id: number; status: string }>
  getLevel(childId: number): Promise<LevelInfo>
  acceptSuggestion(childId: number): Promise<{ applied: boolean }>
  demoReset(): Promise<{ status: string }>

  // Прогресс бобра хранится на сервере, чтобы был одним и тем же на всех устройствах
  // Виртуальная карта подростка и заказ пластика
  getVirtualCard(childId: number): Promise<VirtualCard>
  issueVirtualCard(childId: number, holder?: string): Promise<VirtualCard>
  setVirtualCardStatus(childId: number, status: 'active' | 'frozen'): Promise<VirtualCard>
  orderPlastic(childId: number, method: 'pickup' | 'delivery', address?: string): Promise<VirtualCard>
  transferVirtualCard(childId: number, direction: 'to_card' | 'to_account', amountCents: number): Promise<VirtualCard>

  getBeaver(childId: number): Promise<BeaverSave>
  putBeaver(childId: number, data: Record<string, unknown>, updatedAt: number): Promise<BeaverSave>

  // Подтверждение покупок родителем
  listPendingPurchases(): Promise<{ items: PendingPurchase[] }>
  listPendingBonuses(): Promise<{ items: PendingBonus[] }>
  approveBonus(id: number): Promise<BonusDecision>
  rejectBonus(id: number): Promise<BonusDecision>
  approvePurchase(txId: number): Promise<ApproveResult>
  declinePurchase(txId: number): Promise<ApproveResult>
  // Карманные деньги
  getAllowance(childId: number): Promise<Allowance>
  putAllowance(childId: number, a: { amount_cents: number; period: 'day' | 'week'; active: boolean }): Promise<Allowance>
  payAllowance(childId: number): Promise<{ balance_cents: number }>
  // Права ребёнка в Moby
  getPermissions(childId: number): Promise<{ items: Permission[] }>
  putPermissions(childId: number, items: { key: PermissionKey; enabled: boolean }[]): Promise<{ items: Permission[] }>
  // Уроки финансовой грамотности
  getLessons(childId?: number): Promise<{ items: Lesson[] }>
  answerLesson(lessonId: number, optionIndex: number): Promise<LessonResult>
  // Лояльность
  getLoyalty(childId?: number): Promise<LoyaltyInfo>
  redeemOffer(offerId: number): Promise<{ points: number; code: string }>
  // Потеря карты: блок старой и перевыпуск
  reissueCard(cardId: number): Promise<{ id: number; last4: string; status: string }>
}

const base = (import.meta.env.VITE_API_URL as string | undefined)?.trim()

// Есть адрес бэкенда — ходим на него, иначе работает mock в браузере.
export const api: Api = base ? realApi(base) : mockApi()
export const usingMock = !base
