import type { Api } from './index'
import { session } from './index'
import { demoSession } from './demoSession'

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function realApi(base: string): Api {
  const root = base.replace(/\/$/, '')

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(root + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-User-Id': String(session.userId), 'X-Demo-Session': demoSession.code },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      // Формат ошибок из docs/api.md: {"error": "...", "message": "..."}
      let err = { error: 'error', message: `Ошибка ${res.status}` }
      try { err = await res.json() } catch { /* тело не JSON */ }
      throw new ApiError(err.error, err.message)
    }
    return res.json() as Promise<T>
  }

  const get = <T,>(p: string) => call<T>('GET', p)
  const post = <T,>(p: string, b?: unknown) => call<T>('POST', p, b ?? {})
  const put = <T,>(p: string, b: unknown) => call<T>('PUT', p, b)

  return {
    login: (login) => post('/login', { login }),
    getMe: () => get('/me'),
    getFamily: () => get('/family'),
    createPackage: (r) => post('/family/package', r),
    getChild: (id) => get(`/children/${id}`),
    topup: (id, amount_cents) => post(`/children/${id}/topup`, { amount_cents }),
    blockCard: (id) => post(`/cards/${id}/block`),
    unblockCard: (id) => post(`/cards/${id}/unblock`),
    getLimits: (id) => get(`/children/${id}/limits`),
    putLimits: (id, items) => put(`/children/${id}/limits`, { items }),
    simulatePayment: (r) => post('/payments/simulate', r),
    getTransactions: (id, limit = 20) => get(`/children/${id}/transactions?limit=${limit}`),
    createRequest: (r) => post('/requests', r),
    listRequests: (status) => get(`/requests${status ? `?status=${status}` : ''}`),
    approveRequest: (id) => post(`/requests/${id}/approve`),
    rejectRequest: (id) => post(`/requests/${id}/reject`),
    createGoal: (title, target_cents) => post('/goals', { title, target_cents }),
    getGoals: (id) => get(`/children/${id}/goals`),
    depositGoal: (id, amount_cents) => post(`/goals/${id}/deposit`, { amount_cents }),
    withdrawGoal: (id, amount_cents) => post(`/goals/${id}/withdraw`, { amount_cents }),
    setGoalBonus: (id, parent_bonus_percent) => put(`/goals/${id}/bonus`, { parent_bonus_percent }),
    createTask: (r) => post('/tasks', r),
    listTasks: (childId) => get(`/tasks${childId ? `?child_id=${childId}` : ''}`),
    taskDone: (id) => post(`/tasks/${id}/done`),
    taskConfirm: (id) => post(`/tasks/${id}/confirm`),
    taskReject: (id) => post(`/tasks/${id}/reject`),
    getLevel: (id) => get(`/children/${id}/level`),
    acceptSuggestion: (id) => post(`/children/${id}/level/suggestion/accept`),
    demoReset: () => post('/demo/reset'),
    getVirtualCard: (id) => get(`/children/${id}/virtual-card`),
    issueVirtualCard: (id, holder) => post(`/children/${id}/virtual-card`, { holder }),
    setVirtualCardStatus: (id, status) => post(`/children/${id}/virtual-card/status`, { status }),
    orderPlastic: (id, method, address) => post(`/children/${id}/virtual-card/plastic`, { method, address }),
    transferVirtualCard: (id, direction, amount_cents) => post(`/children/${id}/virtual-card/transfer`, { direction, amount_cents }),
    getBeaver: (id) => get(`/children/${id}/beaver`),
    putBeaver: (id, data, updated_at) => put(`/children/${id}/beaver`, { data, updated_at }),

    listPendingPurchases: () => get('/purchases/pending'),
    listPendingBonuses: () => get('/bonuses/pending'),
    approveBonus: (id) => post(`/bonuses/${id}/approve`),
    rejectBonus: (id) => post(`/bonuses/${id}/reject`),
    approvePurchase: (id) => post(`/transactions/${id}/approve`),
    declinePurchase: (id) => post(`/transactions/${id}/decline`),
    getAllowance: (id) => get(`/children/${id}/allowance`),
    putAllowance: (id, a) => put(`/children/${id}/allowance`, a),
    payAllowance: (id) => post(`/children/${id}/allowance/pay`),
    getPermissions: (id) => get(`/children/${id}/permissions`),
    putPermissions: (id, items) => put(`/children/${id}/permissions`, { items }),
    getLessons: (childId) => get(`/lessons${childId ? `?child_id=${childId}` : ''}`),
    answerLesson: (id, option_index) => post(`/lessons/${id}/answer`, { option_index }),
    getLoyalty: (childId) => get(`/loyalty${childId ? `?child_id=${childId}` : ''}`),
    redeemOffer: (id) => post(`/loyalty/offers/${id}/redeem`),
    reissueCard: (id) => post(`/cards/${id}/reissue`),
  }
}
