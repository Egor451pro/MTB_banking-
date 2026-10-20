import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { plural } from '../format'
import { useData } from '../hooks'
import { Btn, Card, Header, Loading, Note, Progress, Row, Section, Sheet } from '../ui'
import '../beaver.css'

// Вкладка «Бобёр»: питомец строит плотину из брёвен.
// Брёвна ребёнок зарабатывает за реальные финансовые действия (их считаем из уже существующих данных:
// накопления в целях, подтверждённые задания, достигнутые цели, пройденные уроки). Купить брёвна нельзя.
// Потраченные на стройку брёвна и показанный уровень пока хранятся в браузере;
// на бэкенд это переедет вместе с таблицей питомца.
//
// Две сцены:
//  1) «Построить» — бобёр в своей одежде бросает брёвна по одному, плотина вздрагивает;
//  2) переход на новый уровень — бобёр переодевается в строителя, плотина достраивается
//     несколько секунд (картинка плавно перетекает в новый уровень), он комментирует работу.

const LOGS_PER_BUILD = 5
const LOGS_PER_5_BYN = 1
const LOGS_PER_TASK = 3
const LOGS_PER_GOAL_DONE = 20
const LOGS_PER_LESSON = 2

const PRE_WORK_MS = 250    // пауза перед первым броском
const THROW_GAP_MS = 800   // пауза между бросками
const FLIGHT_MS = 560      // сколько летит бревно
const SPEECH_AT_WORK = ['Таскаю брёвна!', 'Ещё одно бревно!', 'Держись, плотина!', 'Почти готово…', 'Хоп!']

const LEVEL_BUILD_MS = 9000 // сколько достраивается плотина при переходе на новый уровень
const SPEECH_AT_LEVEL = ['Надеваю каску!', 'Строю плотину!', 'Укладываю брёвна…', 'Закрепляю ветками…', 'Почти готово!']
const BUILDER_FALLBACK = '/beaver/builder.png' // общий строитель, пока нет отдельных для малыша и подростка

// need — сколько брёвен нужно уже построить, чтобы достичь уровня
export const DAM_LEVELS = [
  { n: 1, need: 0, title: 'Ручеёк' },
  { n: 2, need: 15, title: 'Первая плотина' },
  { n: 3, need: 40, title: 'Крепкая плотина' },
  { n: 4, need: 80, title: 'Плотина с домиком' },
]

const builtKey = (id: number) => `beaver:${id}`
const shownKey = (id: number) => `beaver:${id}:lv`
function loadNum(key: string): number | null {
  try {
    const v = localStorage.getItem(key)
    return v === null ? null : Number(v) || 0
  } catch { return null }
}
function saveNum(key: string, v: number) {
  try { localStorage.setItem(key, String(v)) } catch { /* без хранилища просто не запоминаем */ }
}

function levelFor(built: number) {
  let lv = DAM_LEVELS[0]
  for (const l of DAM_LEVELS) if (built >= l.need) lv = l
  return lv
}

const logWord = (n: number) => plural(n, 'бревно', 'бревна', 'брёвен')

const CONFETTI_COLORS = ['#2B5FDB', '#FF5A1F', '#E5271E', '#FFD24D', '#6AA6F3']

/** Бревно, нарисованное стилем: коричневый цилиндр с кольцами на торце */
function LogShape() {
  return (
    <span className="relative block h-[18px] w-[46px] rounded-full bg-gradient-to-b from-[#B07A42] to-[#7A4C22] shadow-[0_3px_5px_rgba(0,0,0,0.3)]">
      <span className="absolute right-0 top-0 h-[18px] w-[18px] rounded-full bg-[#E3B77A] ring-2 ring-[#7A4C22]">
        <span className="absolute inset-[4px] rounded-full ring-1 ring-[#B07A42]" />
      </span>
    </span>
  )
}

export function BeaverScreen({ meId, ageGroup }: { meId: number; ageGroup: string }) {
  const teen = ageGroup === '14-17'
  const sprite = teen ? '/beaver/teen.png' : '/beaver/kid.png'
  const spriteUp = teen ? '/beaver/teen.png' : '/beaver/kid-wave.png'
  const spriteBuilder = teen ? '/beaver/teen-builder.png' : '/beaver/kid-builder.png'

  const goals = useData(() => api.getGoals(meId), [meId], 3000)
  const tasks = useData(() => api.listTasks(), [], 3000)
  const lessons = useData(() => api.getLessons(), [], 3000)
  const [built, setBuilt] = useState(() => loadNum(builtKey(meId)) ?? 0)
  // Какой уровень плотины сейчас показан. Он отстаёт от «заслуженного», пока идёт достройка.
  const [shown, setShown] = useState(() => loadNum(shownKey(meId)) ?? levelFor(loadNum(builtKey(meId)) ?? 0).n)
  const [bump, setBump] = useState(0)
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const [throwing, setThrowing] = useState(false)
  const [target, setTarget] = useState<number | null>(null) // уровень, который сейчас достраивается
  const [cProg, setCProg] = useState(0)                      // 0..1 — ход достройки
  const [flying, setFlying] = useState<number[]>([])
  const [pops, setPops] = useState<number[]>([])
  const [confetti, setConfetti] = useState(false)
  const [speech, setSpeech] = useState<string | null>(null)

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

  const confettiPieces = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      left: 4 + Math.random() * 92,
      delay: Math.random() * 0.5,
      dur: 1.3 + Math.random() * 0.9,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rot: Math.random() * 360,
    })),
    [],
  )

  const thud = (strong = false) => {
    damRef.current?.animate(
      [
        { transform: 'translate(0,0) scale(1)' },
        { transform: `translate(2px,3px) scale(${strong ? 1.02 : 1.012})`, offset: 0.3 },
        { transform: 'translate(-2px,1px) scale(1.006)', offset: 0.6 },
        { transform: 'translate(0,0) scale(1)' },
      ],
      { duration: 280, easing: 'ease-out' },
    )
  }

  // Переход на новый уровень: бобёр-строитель достраивает плотину LEVEL_BUILD_MS
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
        setShown(to)
        saveNum(shownKey(meId), to)
        setTarget(null)
        setSpeech('Плотина готова!')
        later(() => setSpeech(null), 1600)
        setConfetti(true)
        later(() => setConfetti(false), 2200)
        later(() => setLevelUp(to), 1000)
      }
    }, 120)
    intervals.current.push(iv)
  }

  // Зашли на вкладку, а «заслуженный» уровень выше показанного — значит плотину ещё достраивать
  useEffect(() => {
    const earnedLevel = levelFor(built).n
    if (earnedLevel > shown && target === null && !throwing) startConstruction(earnedLevel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!goals.data || !tasks.data || !lessons.data) return <><Header title="Мой бобёр" /><Loading /></>

  const g = goals.data.items
  const fromGoals = g.reduce((s, x) => s + Math.floor(x.saved_cents / 500) * LOGS_PER_5_BYN + (x.status === 'done' ? LOGS_PER_GOAL_DONE : 0), 0)
  const fromTasks = tasks.data.items.filter((t) => t.status === 'confirmed').length * LOGS_PER_TASK
  const fromLessons = lessons.data.items.filter((l) => l.completed).length * LOGS_PER_LESSON
  const earned = fromGoals + fromTasks + fromLessons
  const balance = Math.max(0, earned - built)

  const constructing = target !== null
  const busy = throwing || constructing
  const earnedLevel = levelFor(built)
  const shownLevel = DAM_LEVELS.find((l) => l.n === shown) ?? DAM_LEVELS[0]
  const next = DAM_LEVELS.find((l) => l.n === earnedLevel.n + 1)
  const spend = Math.min(LOGS_PER_BUILD, balance)

  // Бобёр бросает брёвна по одному: прыжок → полёт → шлепок о плотину → +1 к постройке
  const build = () => {
    if (busy || spend <= 0) return
    setThrowing(true)
    let cur = built
    for (let i = 0; i < spend; i++) {
      later(() => {
        setSpeech(SPEECH_AT_WORK[i % SPEECH_AT_WORK.length])
        const id = ++uid.current
        setFlying((f) => [...f, id])
        beaverRef.current?.animate(
          [
            { transform: 'translateY(0) scale(1,1)' },
            { transform: 'translateY(-16px) scale(0.97,1.05)', offset: 0.4 },
            { transform: 'translateY(0) scale(1.04,0.96)', offset: 0.75 },
            { transform: 'translateY(0) scale(1,1)' },
          ],
          { duration: 420, easing: 'ease-out' },
        )
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
      else {
        setSpeech('Готово!')
        later(() => setSpeech(null), 1200)
      }
    }, PRE_WORK_MS + (spend - 1) * THROW_GAP_MS + FLIGHT_MS + 250)
  }

  const upLevel = DAM_LEVELS.find((l) => l.n === levelUp)
  const pct = Math.round(cProg * 100)

  return (
    <>
      <Header
        title="Мой бобёр"
        subtitle="Копи — и плотина растёт"
        right={
          <div key={bump} className="anim-log flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-[15px] font-bold tabular-nums text-mt-ink">
            <span aria-hidden>🪵</span>{balance}
          </div>
        }
      />
      <div className="space-y-5 px-4 pb-6 pt-4">
        <div className="relative aspect-[4/3.3] overflow-hidden rounded-[28px] shadow-[0_14px_30px_-18px_rgba(20,20,22,0.45)]">
          <div ref={damRef} className="absolute inset-0">
            {DAM_LEVELS.map((l) => {
              // показанный уровень виден полностью, достраиваемый проступает поверх по мере работы
              const opacity = l.n === shown ? 1 : l.n === target ? cProg : 0
              return (
                <img
                  key={l.n} src={`/beaver/dam${l.n}.jpg`} alt={l.title} draggable={false}
                  className={`absolute inset-0 h-full w-full object-cover ${constructing ? 'transition-opacity duration-150 ease-linear' : 'transition-opacity duration-1000'}`}
                  style={{ opacity }}
                />
              )
            })}
          </div>

          <div ref={beaverRef} className="absolute bottom-1 left-2 h-[68%]">
            <img
              src={constructing ? spriteBuilder : sprite} alt="Бобёр" draggable={false}
              onError={(e) => {
                const el = e.currentTarget
                if (el.src.endsWith(spriteBuilder)) el.src = BUILDER_FALLBACK
                else if (el.src.endsWith(BUILDER_FALLBACK)) el.src = sprite
              }}
              className={`${constructing ? 'anim-work' : 'anim-bob'} h-full select-none drop-shadow-[0_6px_6px_rgba(0,0,0,0.18)]`}
            />
          </div>

          {speech && (
            <div key={speech} className="anim-speech pointer-events-none absolute right-3 top-14 z-10 max-w-[56%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-[13px] font-semibold text-[#141416] shadow-[0_6px_16px_-8px_rgba(0,0,0,0.45)]">
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
            <span key={id} className="anim-pop pointer-events-none absolute z-10 text-lg font-extrabold text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.45)]" style={{ left: '58%', bottom: '40%' }}>
              +1 🪵
            </span>
          ))}

          {confetti && confettiPieces.map((c, i) => (
            <span
              key={i}
              className="anim-confetti pointer-events-none absolute -top-3 z-20 h-2.5 w-1.5 rounded-[2px]"
              style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, transform: `rotate(${c.rot}deg)` }}
            />
          ))}

          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#2334C8]">
            {constructing ? `🚧 Плотина строится… ${pct}%` : `Уровень ${shownLevel.n} · ${shownLevel.title}`}
          </div>

          {constructing && (
            <div className="absolute inset-x-0 bottom-0 z-10 h-1.5 bg-black/20">
              <div className="h-full bg-gradient-to-r from-[#FF5A1F] to-[#E5271E]" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>

        <Card>
          <div className="flex items-baseline justify-between">
            <div className="text-[15px] font-semibold text-mt-ink">{next ? `До уровня ${next.n}` : 'Плотина построена!'}</div>
            {next && <div className="text-[15px] font-bold tabular-nums text-[#2334C8]">{built} / {next.need} 🪵</div>}
          </div>
          <div className="mt-3"><Progress value={next ? built : 1} max={next ? next.need : 1} tone="brand" /></div>
          <div className="mt-2 text-[13px] text-muted">
            {next ? `На новом уровне: «${next.title}»` : 'Максимальный уровень. Скоро появятся новые.'}
          </div>
        </Card>

        <Btn onClick={build} disabled={busy || balance <= 0}>
          {constructing
            ? 'Плотина строится…'
            : throwing
              ? 'Бобёр кидает брёвна…'
              : balance > 0
                ? `Построить: положить ${spend} ${logWord(spend)}`
                : 'Пока нет брёвен — заработай их ниже'}
        </Btn>

        <Section title="Как получить брёвна">
          <Card className="divide-y divide-line p-0">
            <Row icon="target" iconTone="blue" title="Пополняй цели" sub={`+${LOGS_PER_5_BYN} ${logWord(LOGS_PER_5_BYN)} за каждые 5 BYN. Бонус родителя тоже считается`} />
            <Row icon="tasks" iconTone="blue" title="Выполняй задания" sub={`+${LOGS_PER_TASK} ${logWord(LOGS_PER_TASK)}, когда родитель подтвердит`} />
            <Row icon="check" iconTone="blue" title="Достигай целей" sub={`+${LOGS_PER_GOAL_DONE} ${logWord(LOGS_PER_GOAL_DONE)} за каждую цель`} />
            <Row icon="book" iconTone="blue" title="Проходи уроки" sub={`+${LOGS_PER_LESSON} ${logWord(LOGS_PER_LESSON)} за урок`} />
          </Card>
        </Section>

        <Note icon="shield">Брёвна нельзя купить за деньги, только заработать. Бобёр не болеет и не грустит, если ты пропустил день.</Note>
      </div>

      <Sheet open={levelUp !== null} onClose={() => setLevelUp(null)} title="Новый уровень!">
        {upLevel && (
          <div className="space-y-4 pb-2 text-center">
            <div className="font-display text-[56px] font-extrabold leading-none text-[#2334C8]">{upLevel.n}</div>
            <div className="text-lg font-semibold text-mt-ink">{upLevel.title}</div>
            <div className="relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-[22px]">
              <img src={`/beaver/dam${upLevel.n}.jpg`} alt="" className="h-full w-full object-cover" />
              <img src={spriteUp} alt="" className="anim-bob absolute bottom-1 left-2 h-[68%]" />
            </div>
            <div className="text-sm text-muted">Плотина стала крепче. Копишь — растёшь!</div>
            <Btn onClick={() => setLevelUp(null)}>Отлично!</Btn>
          </div>
        )}
      </Sheet>
    </>
  )
}
