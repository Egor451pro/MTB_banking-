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

export type CardSlot = 'main' | 'virtual'
export const DEFAULT_DESIGN: Record<CardSlot, string> = { main: 'grad', virtual: 'classic' }

const key = (childId: number, slot: CardSlot) => `mrk.cardDesign.${childId}.${slot}`
const EVENT = 'mrk-card-design'

export function designById(id: string | null | undefined, slot: CardSlot): CardDesign {
  return TEEN_DESIGNS.find((d) => d.id === id) ?? TEEN_DESIGNS.find((d) => d.id === DEFAULT_DESIGN[slot])!
}

function read(childId: number, slot: CardSlot): CardDesign {
  try { return designById(localStorage.getItem(key(childId, slot)), slot) } catch { return designById(null, slot) }
}

export function useCardDesign(childId: number, slot: CardSlot): [CardDesign, (id: string) => void] {
  const [d, setD] = useState(() => read(childId, slot))
  useEffect(() => {
    const sync = () => setD(read(childId, slot))
    sync()
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [childId, slot])
  const set = (id: string) => {
    try { localStorage.setItem(key(childId, slot), id) } catch { /* без хранилища выбор живёт до перезагрузки */ }
    setD(designById(id, slot))
    window.dispatchEvent(new Event(EVENT))
  }
  return [d, set]
}
