import type { Category, DeclineReason, ReqType } from './types'
import type { IconName } from './icons'

// Деньги приходят в копейках; в рубли переводим только здесь, на экране.
export function money(cents: number): string {
  const sign = cents < 0 ? '−' : ''
  const abs = Math.abs(cents)
  const r = Math.floor(abs / 100)
  const k = String(abs % 100).padStart(2, '0')
  return `${sign}${r.toLocaleString('ru-RU')},${k} BYN`
}

// "12,5" или "12.5" -> 1250 копеек. Пустое и некорректное -> NaN.
export function toCents(input: string): number {
  const n = Number(input.replace(',', '.').trim())
  if (!isFinite(n) || n < 0 || input.trim() === '') return NaN
  return Math.round(n * 100)
}

export const CATEGORY_LABEL: Record<Category, string> = {
  food: 'Еда',
  transport: 'Транспорт',
  games: 'Игры',
  subscriptions: 'Подписки',
  shopping: 'Покупки',
  entertainment: 'Развлечения',
  education: 'Обучение',
  adult18: 'Категория 18+',
}

export const CATEGORY_ICON: Record<Category, IconName> = {
  food: 'food',
  transport: 'bus',
  games: 'game',
  subscriptions: 'play',
  shopping: 'bag',
  entertainment: 'ticket',
  education: 'book',
  adult18: 'ban',
}

export const DECLINE_TEXT: Record<DeclineReason, string> = {
  card_blocked: 'Карта заблокирована',
  category_blocked: 'Категория запрещена',
  online_not_allowed: 'Онлайн-покупки не разрешены',
  insufficient_funds: 'Не хватает денег на карте',
  limit_exceeded: 'Превышен лимит',
}

export const REQ_LABEL: Record<ReqType, string> = {
  money: 'Деньги на карту',
  limit_increase: 'Поднять дневной лимит',
  category_unlock: 'Открыть категорию',
}

export const REQ_SHORT: Record<ReqType, string> = {
  money: 'Деньги',
  limit_increase: 'Лимит',
  category_unlock: 'Категория',
}

// 1 запрос, 2 запроса, 5 запросов
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

// API отдаёт '7-13', показываем с длинным тире
export const ageLabel = (g: string) => `${g.replace('-', '–')} лет`

export function dateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function ageFrom(birth: string, now = new Date()): number {
  const b = new Date(birth)
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}
