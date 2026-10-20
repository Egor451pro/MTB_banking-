import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { plural } from '../format'
import { useData } from '../hooks'
import { Btn, Card, Loading, Progress, Row, Sheet } from '../ui'
import '../beaver.css'

// Вкладка «Бобёр»: питомец строит плотину из брёвен.
// Брёвна считаются из реальных действий: накопления в целях, подтверждённые задания,
// достигнутые цели, пройденные уроки. Купить их нельзя.
// Прогресс (сколько брёвен уложено, какой уровень открыт) пока хранится в браузере.
//
// Сцены:
//  1) «Построить» — бобёр бросает брёвна по одному;
//  2) набран новый уровень — бобёр в форме строителя, плотина закрыта и достраивается;
//  3) стройка закончена — кнопка «Открыть плотину», по нажатию плотина раскрывается.

const LOGS_PER_BUILD = 5
export const LOGS_PER_5_BYN = 1
export const LOGS_PER_TASK = 3
export const LOGS_PER_GOAL_DONE = 20
export const LOGS_PER_LESSON = 2

const PRE_WORK_MS = 250
const THROW_GAP_MS = 800
const FLIGHT_MS = 560
const LEVEL_BUILD_MS = 9000
const REVEAL_MS = 1900

const SPEECH_AT_LEVEL = ['Надеваю каску', 'Строю плотину', 'Укладываю брёвна', 'Закрепляю ветками', 'Почти готово']

export const DAM_LEVELS = [
  { n: 1, need: 0, title: 'Ручеёк' },
  { n: 2, need: 15, title: 'Первая плотина' },
  { n: 3, need: 40, title: 'Крепкая плотина' },
  { n: 4, need: 80, title: 'Плотина с домиком' },
]

export const builtKey = (id: number) => `beaver:${id}`
export const shownKey = (id: number) => `beaver:${id}:lv`
const readyKey = (id: number) => `beaver:${id}:ready`
export function loadNum(key: string): number | null {
  try {
    const v = localStorage.getItem(key)
    return v === null ? null : Number(v) || 0
  } catch { return null }
}
function saveNum(key: string, v: number | null) {
  try {
    if (v === null) localStorage.removeItem(key)
    else localStorage.setItem(key, String(v))
  } catch { /* без хранилища просто не запоминаем */ }
}

export function levelFor(built: number) {
  let lv = DAM_LEVELS[0]
  for (const l of DAM_LEVELS) if (built >= l.need) lv = l
  return lv
}
export const levelByN = (n: number) => DAM_LEVELS.find((l) => l.n === n) ?? DAM_LEVELS[0]
export const damSrc = (n: number) => `/beaver/dam${n}.jpg`
export const logWord = (n: number) => plural(n, 'бревно', 'бревна', 'брёвен')

/** Какой уровень плотины открыт у ребёнка — для главной, профиля и экрана родителя */
export function beaverInfo(childId: number) {
  const built = loadNum(builtKey(childId)) ?? 0
  const shown = levelByN(loadNum(shownKey(childId)) ?? levelFor(built).n)
  const next = DAM_LEVELS.find((l) => l.n === levelFor(built).n + 1)
  return { level: shown, built, next }
}

/** Иконка бревна в стиле остальных иконок приложения (контур, без эмодзи) */
function LogIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className} aria-hidden>
      <path d="M5 8h12" /><path d="M5 16h12" />
      <ellipse cx="5" cy="12" rx="2.2" ry="4" />
      <ellipse cx="17" cy="12" rx="2.2" ry="4" />
      <circle cx="17" cy="12" r="1" />
    </svg>
  )
}

/** Летящее бревно */
function LogShape() {
  return (
    <span className="relative block h-[18px] w-[46px] rounded-full bg-gradient-to-b from-[#B07A42] to-[#7A4C22] shadow-[0_3px_5px_rgba(0,0,0,0.3)]">
      <span className="absolute right-0 top-0 h-[18px] w-[18px] rounded-full bg-[#E3B77A] ring-2 ring-[#7A4C22]">
        <span className="absolute inset-[4px] rounded-full ring-1 ring-[#B07A42]" />
      </span>
    </span>
  )
}

/** Блок с бобром и плотиной. Стоит наверху вкладки «Копилка». */
export function BeaverPanel({ meId, ageGroup }: { meId: number; ageGroup: string }) {
  const teen = ageGroup === '14-17'
  const sprite = teen ? '/beaver/teen.png' : '/beaver/kid.png'
  const spriteCheer = teen ? '/beaver/teen.png' : '/beaver/kid-wave.png'
  const spriteBuilder = teen ? '/beaver/teen-builder.png' : '/beaver/kid-builder.png'

  const goals = useData(() => api.getGoals(meId), [meId], 3000)
  const tasks = useData(() => api.listTasks(), [], 3000)
  const lessons = useData(() => api.getLessons(), [], 3000)

  const [built, setBuilt] = useState(() => loadNum(builtKey(meId)) ?? 0)
  const [shown, setShown] = useState(() => loadNum(shownKey(meId)) ?? levelFor(loadNum(builtKey(meId)) ?? 0).n)
  const [ready, setReady] = useState<number | null>(() => loadNum(readyKey(meId)))   // достроено, но ещё не открыто
  const [target, setTarget] = useState<number | null>(null)                          // сейчас достраивается
  const [cProg, setCProg] = useState(0)
  const [throwing, setThrowing] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [cheer, setCheer] = useState(false)
  const [flying, setFlying] = useState<number[]>([])
  const [pops, setPops] = useState<number[]>([])
  const [speech, setSpeech] = useState<string | null>(null)
  const [bump, setBump] = useState(0)
  const [howTo, setHowTo] = useState(false)

  const sceneRef = useRef<HTMLDivElement>(null)
  const damRef = useRef<HTMLDivElement>(null)
  const beaverRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  const intervals = useRef<number[]>([])
  const uid = useRef(0)
  useEffect(() => () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    intervals.current.forEach((t) => window.clearInterval(t))
  }, [])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  const thud = () => {
    damRef.current?.animate(
      [
        // небольшое увеличение во время тряски, чтобы края картинки не открывали фон блока
        { transform: 'translate(0,0) scale(1)' },
        { transform: 'translate(2px,3px) scale(1.04)', offset: 0.3 },
        { transform: 'translate(-2px,1px) scale(1.03)', offset: 0.6 },
        { transform: 'translate(0,0) scale(1)' },
      ],
      { duration: 260, easing: 'ease-out' },
    )
  }
  const hop = (height = 16, duration = 420) => {
    beaverRef.current?.animate(
      [
        { transform: 'translateY(0) scale(1,1)' },
        { transform: `translateY(-${height}px) scale(0.97,1.05)`, offset: 0.4 },
        { transform: 'translateY(0) scale(1.04,0.96)', offset: 0.75 },
        { transform: 'translateY(0) scale(1,1)' },
      ],
      { duration, easing: 'ease-out' },
    )
  }

  const startConstruction = (to: number) => {
    setTarget(to)
    setCProg(0)
    setSpeech(SPEECH_AT_LEVEL[0])
    const t0 = Date.now()
    let lastHit = -1
    const iv = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / LEVEL_BUILD_MS)
      setCProg(p)
      setSpeech(SPEECH_AT_LEVEL[Math.min(SPEECH_AT_LEVEL.length - 1, Math.floor(p * SPEECH_AT_LEVEL.length))])
      const hit = Math.floor((Date.now() - t0) / 700)
      if (hit !== lastHit) { lastHit = hit; thud() }
      if (p >= 1) {
        window.clearInterval(iv)
        setTarget(null)
        setReady(to)
        saveNum(readyKey(meId), to)
        setSpeech('Готово! Открывай')
      }
    }, 120)
    intervals.current.push(iv)
  }

  const reveal = () => {
    if (ready === null || revealing) return
    const to = ready
    setSpeech(null)
    setRevealing(true)
    setShown(to)
    saveNum(shownKey(meId), to)
    setReady(null)
    saveNum(readyKey(meId), null)
    sceneRef.current?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.97)', offset: 0.15 }, { transform: 'scale(1.015)', offset: 0.6 }, { transform: 'scale(1)' }],
      { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
    later(() => { setCheer(true); hop(26, 520) }, 500)
    later(() => setRevealing(false), REVEAL_MS)
    later(() => setCheer(false), 3200)
  }

  // Вернулись на вкладку: либо плотина ждёт открытия, либо её надо достроить
  useEffect(() => {
    if (ready !== null && ready > shown) return
    if (ready !== null) { setReady(null); saveNum(readyKey(meId), null) }
    const earnedLevel = levelFor(built).n
    if (earnedLevel > shown) startConstruction(earnedLevel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!goals.data || !tasks.data || !lessons.data) return <Loading />

  const fromGoals = goals.data.items.reduce((s, x) => s + Math.floor(x.saved_cents / 500) * LOGS_PER_5_BYN + (x.status === 'done' ? LOGS_PER_GOAL_DONE : 0), 0)
  const fromTasks = tasks.data.items.filter((t) => t.status === 'confirmed').length * LOGS_PER_TASK
  const fromLessons = lessons.data.items.filter((l) => l.completed).length * LOGS_PER_LESSON
  const balance = Math.max(0, fromGoals + fromTasks + fromLessons - built)

  const constructing = target !== null
  const pending = target ?? ready            // уровень за «закрытой» плотиной
  const hidden = pending !== null
  const earnedLevel = levelFor(built)
  const next = DAM_LEVELS.find((l) => l.n === earnedLevel.n + 1)
  // перед новым уровнем кладём ровно столько, сколько до него осталось
  const toNext = next ? next.need - built : Infinity
  const spend = Math.max(0, Math.min(LOGS_PER_BUILD, balance, toNext))
  const busy = throwing || hidden || revealing
  const pct = Math.round(cProg * 100)

  const build = () => {
    if (busy || spend <= 0) return
    setThrowing(true)
    let cur = built
    for (let i = 0; i < spend; i++) {
      later(() => {
        const id = ++uid.current
        setFlying((f) => [...f, id])
        hop()
        later(() => {
          setFlying((f) => f.filter((x) => x !== id))
          cur += 1
          setBuilt(cur)
          saveNum(builtKey(meId), cur)
          setBump((b) => b + 1)
          setPops((p) => [...p, id])
          later(() => setPops((p) => p.filter((x) => x !== id)), 900)
          thud()
        }, FLIGHT_MS)
      }, PRE_WORK_MS + i * THROW_GAP_MS)
    }
    later(() => {
      setThrowing(false)
      const reached = levelFor(cur).n
      if (reached > shown) startConstruction(reached)
    }, PRE_WORK_MS + (spend - 1) * THROW_GAP_MS + FLIGHT_MS + 250)
  }

  const beaverSrc = hidden ? spriteBuilder : cheer ? spriteCheer : sprite
  const shownLevel = levelByN(shown)

  let btnText = `Построить · ${spend} ${logWord(spend)}`
  if (constructing) btnText = 'Плотина строится'
  else if (ready !== null) btnText = 'Сначала открой плотину'
  else if (throwing) btnText = 'Бобёр работает'
  else if (balance <= 0) btnText = 'Нет брёвен'

  return (
    <>
      <div className="space-y-3">
        <div ref={sceneRef} className="relative aspect-[4/3.3] overflow-hidden rounded-[24px] bg-[#9CC7F2]">
          <div ref={damRef} className="absolute inset-0">
            {hidden ? (
              <img src={damSrc(pending!)} alt="" draggable={false} className="dam-veil absolute inset-0 h-full w-full object-cover" />
            ) : (
              <>
                {revealing && <img src={damSrc(shown)} alt="" draggable={false} className="dam-veil absolute inset-0 h-full w-full object-cover" />}
                <img
                  key={`${shown}:${revealing}`}
                  src={damSrc(shown)} alt={shownLevel.title} draggable={false}
                  className={`absolute inset-0 h-full w-full object-cover ${revealing ? 'dam-reveal' : ''}`}
                />
                {revealing && <div className="dam-shine pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />}
              </>
            )}
          </div>

          {hidden && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pl-[34%] pr-4 text-white">
              {constructing ? (
                <>
                  <div className="text-[13px] font-medium text-white/75">Плотина строится</div>
                  <div className="font-display text-[44px] font-bold leading-none tabular-nums">{pct}%</div>
                  <div className="mt-3 h-1 w-28 overflow-hidden rounded-full bg-white/25">
                    <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
                  </div>
                </>
              ) : (
                <button
                  type="button" onClick={reveal}
                  className="reveal-btn rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-[#141416] transition active:scale-95"
                >
                  Открыть плотину
                </button>
              )}
            </div>
          )}

          <div ref={beaverRef} className="absolute bottom-1 left-2 h-[68%]">
            <img
              src={beaverSrc} alt="Бобёр" draggable={false}
              className={`${constructing ? 'anim-work' : 'anim-bob'} h-full select-none drop-shadow-[0_6px_8px_rgba(0,0,0,0.25)]`}
            />
          </div>

          {speech && (
            <div key={speech} className="anim-speech pointer-events-none absolute left-[30%] top-4 z-10 rounded-2xl rounded-bl-[6px] bg-white px-3 py-1.5 text-[13px] font-medium text-[#141416]">
              {speech}
            </div>
          )}

          {flying.map((id) => (
            <span
              key={id}
              className="log-fly-x pointer-events-none absolute z-10"
              style={{ left: '30%', bottom: '44%', ['--dx' as string]: '128px', ['--dy' as string]: '34px' }}
            >
              <span className="log-fly-y block"><LogShape /></span>
            </span>
          ))}

          {pops.map((id) => (
            <span key={id} className="anim-pop pointer-events-none absolute z-10 text-base font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]" style={{ left: '60%', bottom: '42%' }}>
              +1
            </span>
          ))}

          <div key={bump} className="anim-log absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#141416]">
            <LogIcon size={15} />{balance}
          </div>

          {!hidden && (
            <div key={`chip:${shown}`} className={`absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#141416] ${revealing ? 'chip-in' : ''}`}>
              Уровень {shownLevel.n} · {shownLevel.title}
            </div>
          )}
        </div>

        <Card>
          <div className="flex items-baseline justify-between">
            <div className="text-[15px] font-semibold text-mt-ink">{next ? `До уровня ${next.n}` : 'Все уровни пройдены'}</div>
            {next && <div className="text-[15px] font-semibold tabular-nums text-muted">{built} из {next.need}</div>}
          </div>
          <div className="mt-3"><Progress value={next ? built : 1} max={next ? next.need : 1} tone="brand" /></div>
          {next && <div className="mt-2 text-[13px] text-muted">Дальше: {next.title.toLowerCase()}</div>}
        </Card>

        <Btn onClick={build} disabled={busy || balance <= 0}>{btnText}</Btn>

        <button type="button" onClick={() => setHowTo(true)} className="mx-auto block text-[13px] font-medium text-muted underline-offset-2 hover:underline">
          Как получить брёвна
        </button>
      </div>

      <Sheet open={howTo} onClose={() => setHowTo(false)} title="Как получить брёвна">
        <Card className="divide-y divide-line p-0">
          <Row icon="target" iconTone="blue" title="Отложить в цель" sub="1 бревно за каждые 5 BYN, бонус родителя тоже считается" />
          <Row icon="tasks" iconTone="blue" title="Выполнить задание" sub={`${LOGS_PER_TASK} ${logWord(LOGS_PER_TASK)}, когда родитель подтвердит`} />
          <Row icon="check" iconTone="blue" title="Достичь цели" sub={`${LOGS_PER_GOAL_DONE} брёвен`} />
          <Row icon="book" iconTone="blue" title="Пройти урок" sub={`${LOGS_PER_LESSON} ${logWord(LOGS_PER_LESSON)}`} />
        </Card>
        <p className="mt-3 text-[13px] text-muted">Брёвна нельзя купить, только заработать. Чем больше уложено, тем выше уровень плотины.</p>
      </Sheet>
    </>
  )
}
