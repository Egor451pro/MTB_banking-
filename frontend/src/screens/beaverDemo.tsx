import { useState } from 'react'
import { DAM_LEVELS, demoActions, isFast } from '../beaverState'
import { Icon } from '../icons'

// Панель для показа: стоит в верхней строке вне экрана телефона.
// Позволяет за пару минут пройти весь цикл бобра: уровни, склад, таймер стройки, размыв плотины.
export function BeaverDemo({ childId }: { childId: number }) {
  const [open, setOpen] = useState(false)
  const [, force] = useState(0)
  const run = (fn: () => void) => () => { fn(); force((n) => n + 1) }
  const shifted = demoActions.daysShifted()
  const btn = 'rounded-xl bg-elevated px-3 py-2 text-left text-[13px] font-semibold text-mt-ink transition hover:opacity-80 active:scale-[0.98]'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Управление бобром для показа"
        className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-elevated px-3 py-1 text-[13px] font-semibold text-muted transition hover:text-mt-ink"
      >
        <Icon name="star" size={14} />Бобёр
      </button>
      {open && (
        <>
          <button type="button" aria-label="Закрыть" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-[270px] space-y-2 rounded-2xl bg-card p-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.4)] ring-1 ring-line">
            <div className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Уровень плотины</div>
            <div className="grid grid-cols-4 gap-2">
              {DAM_LEVELS.map((l) => (
                <button key={l.n} type="button" className={`${btn} text-center`} onClick={run(() => demoActions.setLevel(childId, l.n))}>{l.n}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={btn} onClick={run(() => demoActions.addLogs(childId, 10))}>+10 брёвен</button>
              <button type="button" className={btn} onClick={run(() => demoActions.finishBuild(childId))}>Достроить сразу</button>
              <button type="button" className={btn} onClick={run(() => demoActions.damage(childId))}>Ослабить плотину</button>
              <button type="button" className={btn} onClick={run(() => demoActions.skipDay())}>
                +1 день{shifted ? ` (всего ${shifted})` : ''}
              </button>
            </div>
            <button type="button" className={`${btn} w-full`} onClick={run(() => demoActions.toggleFast(childId))}>
              Стройка за 10 секунд: {isFast() ? 'включена' : 'выключена'}
            </button>
            <p className="px-1 text-xs text-muted">«Сбросить демо» возвращает бобра и время в начало.</p>
          </div>
        </>
      )}
    </div>
  )
}
