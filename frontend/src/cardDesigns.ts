import { useEffect, useState } from 'react'

// Дизайны карт подростка (14–17): каждый выбирает свой отдельно для основной и виртуальной карты.
// Выбор хранится на устройстве (localStorage), в проде его стоит хранить на сервере в профиле ребёнка.
export interface CardDesign { id: string; name: string; src: string }

export const TEEN_DESIGNS: CardDesign[] = [
  { id: 'grad', name: 'Выпускник', src: '/card/graduate.jpg' },
  { id: 'classic', name: 'Классика', src: '/card/main.jpg' },
  { id: 'skate', name: 'Скейт', src: '/card/t1.jpg' },
  { id: 'backpack', name: 'В путь', src: '/card/t2.jpg' },
  { id: 'goals', name: 'Большие цели', src: '/card/t3.jpg' },
  { id: 'gamer', name: 'Геймер', src: '/card/t4.jpg' },
  { id: 'travel', name: 'Больше возможностей', src: '/card/t5.jpg' },
  { id: 'can', name: 'Ты можешь больше', src: '/card/t6.jpg' },
  { id: 'peace', name: 'Привет', src: '/card/t7.jpg' },
  { id: 'path', name: 'Свой путь', src: '/card/t8.jpg' },
  { id: 'cap', name: 'Кепка', src: '/card/t9.jpg' },
]

// Детские дизайны (7–13): основной выбор у малышей, а подросткам доступны отдельной плашкой «Детские»
export const KID_DESIGNS: CardDesign[] = [
  { id: 'kid', name: 'Бобёр в кепке', src: '/card/kid.jpg' },
  { id: 'k-dreams', name: 'Большие мечты', src: '/card/k1.jpg' },
  { id: 'k-school', name: 'Урок', src: '/card/k2.jpg' },
  { id: 'k-self', name: 'Будь собой', src: '/card/k3.jpg' },
  { id: 'k-music', name: 'Музыка', src: '/card/k4.jpg' },
  { id: 'k-goal', name: 'Вперёд к целям', src: '/card/k5.jpg' },
  { id: 'k-space', name: 'Космос', src: '/card/k6.jpg' },
  { id: 'k-habits', name: 'Хорошие привычки', src: '/card/k7.jpg' },
  { id: 'k-can', name: 'Ты можешь больше', src: '/card/k8.jpg' },
  { id: 'k-snow', name: 'Сноуборд', src: '/card/k9.jpg' },
]

export type CardSlot = 'main' | 'virtual'
export const DEFAULT_DESIGN: Record<CardSlot, string> = { main: 'grad', virtual: 'classic' }

const key = (childId: number, slot: CardSlot) => `mrk.cardDesign.${childId}.${slot}`
const EVENT = 'mrk-card-design'

export function designById(id: string | null | undefined, slot: CardSlot, def?: string): CardDesign {
  const all = [...TEEN_DESIGNS, ...KID_DESIGNS]
  return all.find((d) => d.id === id) ?? all.find((d) => d.id === (def ?? DEFAULT_DESIGN[slot]))!
}

function read(childId: number, slot: CardSlot, def?: string): CardDesign {
  try { return designById(localStorage.getItem(key(childId, slot)), slot, def) } catch { return designById(null, slot, def) }
}

export function useCardDesign(childId: number, slot: CardSlot, def?: string): [CardDesign, (id: string) => void] {
  const [d, setD] = useState(() => read(childId, slot, def))
  useEffect(() => {
    const sync = () => setD(read(childId, slot, def))
    sync()
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [childId, slot, def])
  const set = (id: string) => {
    try { localStorage.setItem(key(childId, slot), id) } catch { /* без хранилища выбор живёт до перезагрузки */ }
    setD(designById(id, slot, def))
    window.dispatchEvent(new Event(EVENT))
  }
  return [d, set]
}
