import type {
  AccessRequest, Category, ChildDetail, FamilyResp, Goal, LevelInfo, LimitItem, Me,
  PackageReq, PayRequest, PayResult, ReqStatus, ReqType, Task, Transaction,
} from '../types'
import { realApi } from './real'
import { mockApi } from './mock'

// Текущий пользователь. Демо-переключатель меняет его, а клиент шлёт как X-User-Id.
export const session = { userId: 1 }

// Один интерфейс для настоящего API и для mock: экраны не знают, что за ним стоит.
export interface Api {
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
  createRequest(req: { type: ReqType; amount_cents?: number; category?: Category; comment: string }): Promise<{ id: number; status: string }>
  listRequests(status?: ReqStatus): Promise<{ items: AccessRequest[] }>
  approveRequest(id: number): Promise<{ id: number; status: string }>
  rejectRequest(id: number): Promise<{ id: number; status: string }>
  createGoal(title: string, targetCents: number): Promise<Goal>
  getGoals(childId: number): Promise<{ items: Goal[] }>
  depositGoal(id: number, amountCents: number): Promise<{ saved_cents: number; card_balance_cents: number; status: string }>
  setGoalBonus(id: number, percent: number): Promise<{ parent_bonus_percent: number }>
  createTask(req: { assigned_to: number; title: string; reward_cents: number; xp_reward: number; due_date?: string }): Promise<{ id: number; status: string }>
  listTasks(childId?: number): Promise<{ items: Task[] }>
  taskDone(id: number): Promise<{ id: number; status: string }>
  taskConfirm(id: number): Promise<{ id: number; status: string; balance_cents: number; xp: number; level: number }>
  taskReject(id: number): Promise<{ id: number; status: string }>
  getLevel(childId: number): Promise<LevelInfo>
  acceptSuggestion(childId: number): Promise<{ applied: boolean }>
  demoReset(): Promise<{ status: string }>
}

const base = (import.meta.env.VITE_API_URL as string | undefined)?.trim()

// Есть адрес бэкенда — ходим на него, иначе работает mock в браузере.
export const api: Api = base ? realApi(base) : mockApi()
export const usingMock = !base
