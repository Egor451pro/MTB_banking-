import { createContext, useContext, useState, type ReactNode } from 'react'

// Мини-навигация без роутера: вкладки внизу + стек экранов поверх них.
export interface Screen { name: string; params?: Record<string, any> }

interface NavCtx {
  tab: string
  setTab: (t: string) => void
  stack: Screen[]
  push: (s: Screen) => void
  back: () => void
}

const Ctx = createContext<NavCtx>(null as unknown as NavCtx)
export const useNav = () => useContext(Ctx)

export function NavProvider({ initialTab, children }: { initialTab: string; children: ReactNode }) {
  const [tab, setTabState] = useState(initialTab)
  const [stack, setStack] = useState<Screen[]>([])
  const value: NavCtx = {
    tab, stack,
    setTab: (t) => { setTabState(t); setStack([]) },
    push: (s) => setStack((st) => [...st, s]),
    back: () => setStack((st) => st.slice(0, -1)),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
