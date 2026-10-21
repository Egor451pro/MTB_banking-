import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { plural } from '../format'
import { useData } from '../hooks'
import { Btn, Card, Loading, Progress, Row, Sheet, toast } from '../ui'
import {
  CHANGE_EVENT, DAM_LEVELS, DAY, DECAY_PER_DAY, EARN_PER_DAY, GRACE_DAYS, HEAL_PER_LOG, MIN_GOAL_CENTS,
  collapseAt, dayOf, healthAt, levelByN, levelFor, loadState, noteEarned, now, saveState, tickState, useBeaverSync,
  type BeaverState,
} from '../beaverState'
import '../beaver.css'

export { beaverInfo, useBeaverInfo, DAM_LEVELS, levelByN, levelFor } from '../beaverState'

// Вкладка «Бобёр»: питомец строит плотину из брёвен.
// Брёвна считаются из реальных действий: накопления в целях от 20 BYN, подтверждённые задания,
// достигнутые цели, пройденные уроки. Купить их нельзя.
//
// Правила, которые держат интерес:
//  • склад: за день на склад попадает не больше EARN_PER_DAY заработанных брёвен, остальные ждут завтра;
//  • новый уровень достраивается по настоящему таймеру, потом плотину открывают кнопкой;
//  • прочность: если не заходить и не копить, плотина слабеет и в конце концов уровень падает;
//    каждое уложенное бревно её чинит.
// Всё состояние лежит в beaverState.ts.

export const LOGS_PER_5_BYN = 1
export const LOGS_PER_TASK = 3
export const LOGS_PER_LESSON = 2
const GOAL_DONE_CAP = 10

const PRE_WORK_MS = 250
const THROW_GAP_MS = 800
const FLIGHT_MS = 560
const REVEAL_MS = 1900

const SPEECH_AT_LEVEL = ['Надеваю каску', 'Строю плотину', 'Укладываю брёвна', 'Закрепляю ветками', 'Почти готово']

export const damSrc = (n: number) => `/beaver/dam${n}.jpg`
export const logWord = (n: number) => plural(n, 'бревно', 'бревна', 'брёвен')

function fmtLeft(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s < 60) return `${s} с`
  const m = Math.ceil(s / 60)
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} ч ${rest} мин` : `${h} ч`
}

/** Сколько брёвен ребёнок заработал за всё время (без учёта того, сколько уже уложено) */
function earnedLogs(
  goals: { target_cents: number; saved_cents: number; status: string }[],
  confirmedTasks: number,
  doneLessons: number,
) {
  // Цели меньше 20 BYN брёвен не дают: иначе можно копить по рублю и накручивать бонусы
  const fromGoals = goals.reduce((sum, g) => {
    if (g.target_cents < MIN_GOAL_CENTS) return sum
    const saved = Math.floor(g.saved_cents / 500) * LOGS_PER_5_BYN
    const bonus = g.status === 'done' ? Math.min(GOAL_DONE_CAP, Math.floor(g.target_cents / 500)) : 0
    return sum + saved + bonus
  }, 0)
  return fromGoals + confirmedTasks * LOGS_PER_TASK + doneLessons * LOGS_PER_LESSON
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

/** Блок с бобром и плотиной. Сначала подтягиваем сохранённого бобра с сервера, потом рисуем сцену. */
export function BeaverPanel(props: { meId: number; ageGroup: string }) {
  const synced = useBeaverSync(props.meId, true)
  if (!synced) return <Loading />
  return <BeaverScene {...props} />
}

function BeaverScene({ meId, ageGroup }: { meId: number; ageGroup: string }) {
  const teen = ageGroup === '14-17'
  const sprite = teen ? '/beaver/teen.png' : '/beaver/kid.png'
  const spriteCheer = teen ? '/beaver/teen.png' : '/beaver/kid-wave.png'
  const spriteBuilder = teen ? '/beaver/teen-builder.png' : '/beaver/kid-builder.png'

  const goals = useData(() => api.getGoals(meId), [meId], 3000)
  const tasks = useData(() => api.listTasks(), [], 3000)
  const lessons = useData(() => api.getLessons(), [], 3000)

  // Состояние читаем один раз и сразу продвигаем до текущего момента: стройка могла закончиться, плотину могло размыть
  const init = useRef<{ s: BeaverState; dropped: number } | null>(null)
  if (!init.current) init.current = tickState(loadState(meId))
  const [s, setS] = useState<BeaverState>(init.current.s)
  const sRef = useRef(s)
  const [, setClock] = useState(0)

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
  const uid = useRef(0)
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  const commit = (n: BeaverState) => {
    sRef.current = n
    saveState(meId, n)
    setS(n)
  }
  // Раз в секунду и после действий: заканчиваем стройку, меняем день, размываем плотину
  const advance = () => {
    const { s: n, dropped } = tickState(sRef.current)
    if (JSON.stringify(n) !== JSON.stringify(sRef.current)) commit(n)
    if (dropped > 0) {
      toast(`Плотину размыло до уровня ${n.level}`)
      setSpeech('Размыло… давай чинить')
      later(() => setSpeech(null), 4000)
    }
    setClock((c) => c + 1)
  }

  useEffect(() => {
    // сохраняем только если время что-то изменило (размыв, конец стройки), иначе не затираем более свежее состояние с сервера
    if (JSON.stringify(sRef.current) !== JSON.stringify(loadState(meId))) saveState(meId, sRef.current)
    if (init.current && init.current.dropped > 0) toast(`Плотину размыло до уровня ${sRef.current.level}`)
    const iv = window.setInterval(advance, 1000)
    // демо-панель вне телефона меняет состояние: перечитываем
    const onChange = () => { sRef.current = loadState(meId); setS(sRef.current); advance() }
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => {
      window.clearInterval(iv)
      window.removeEventListener(CHANGE_EVENT, onChange)
      timers.current.forEach((t) => window.clearTimeout(t))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId])

  const dataReady = !!(goals.data && tasks.data && lessons.data)
  const earnedBase = dataReady
    ? earnedLogs(
      goals.data!.items,
      tasks.data!.items.filter((t) => t.status === 'confirmed').length,
      lessons.data!.items.filter((l) => l.completed).length,
    )
    : null

  // Новая заработанная активность останавливает отсчёт «бобёр скучает»
  useEffect(() => {
    if (earnedBase === null) return
    const n = noteEarned(sRef.current, earnedBase)
    if (n !== sRef.current) commit(n)
    advance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earnedBase])

  const constructing = s.buildTo !== null
  // Пока плотина достраивается, она слегка вздрагивает от ударов
  useEffect(() => {
    if (!constructing) return
    const iv = window.setInterval(() => thud(), 700)
    return () => window.clearInterval(iv)
  }, [constructing])

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

  const reveal = () => {
    const cur = sRef.current
    if (cur.ready === null || revealing) return
    const t = now()
    setSpeech(null)
    setRevealing(true)
    commit({ ...cur, level: cur.ready, ready: null, hp: 100, lastActive: t })
    sceneRef.current?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.97)', offset: 0.15 }, { transform: 'scale(1.015)', offset: 0.6 }, { transform: 'scale(1)' }],
      { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
    later(() => { setCheer(true); hop(26, 520) }, 500)
    later(() => setRevealing(false), REVEAL_MS)
    later(() => setCheer(false), 3200)
  }

  if (earnedBase === null) return <Loading />

  const t = now()
  const hidden = s.buildTo !== null || s.ready !== null
  const pending = s.buildTo ?? s.ready                      // уровень за «закрытой» плотиной
  const cProg = constructing ? Math.min(1, Math.max(0, (t - s.buildStart) / Math.max(1, s.buildEnd - s.buildStart))) : 0
  const pct = Math.round(cProg * 100)
  const health = healthAt(s, t)
  const earnedToday = s.day === dayOf(t) ? s.earnedToday : 0
  const waiting = Math.max(0, earnedBase - s.credited)
  const balance = Math.max(0, s.credited + s.gift - s.built - s.lost)
  const next = DAM_LEVELS.find((l) => l.n === levelFor(s.built).n + 1)
  // перед новым уровнем кладём ровно столько, сколько до него осталось; на последнем уровне брёвна идут на ремонт
  const toNext = next ? next.need - s.built : Math.ceil((100 - health) / HEAL_PER_LOG)
  const spend = Math.max(0, Math.min(balance, toNext))
  const busy = throwing || hidden || revealing
  const shownLevel = levelByN(s.level)
  const daysLeft = Math.max(0, Math.ceil((collapseAt(s) - t) / DAY))
  const lowHp = s.level > 1 && health < 50

  const build = () => {
    if (busy || spend <= 0) return
    setThrowing(true)
    for (let i = 0; i < spend; i++) {
      later(() => {
        const id = ++uid.current
        setFlying((f) => [...f, id])
        hop()
        later(() => {
          setFlying((f) => f.filter((x) => x !== id))
          const cur = sRef.current
          const tt = now()
          commit({
            ...cur,
            built: cur.built + 1,
            hp: Math.min(100, healthAt(cur, tt) + HEAL_PER_LOG),
            lastActive: tt,
          })
          setBump((b) => b + 1)
          setPops((p) => [...p, id])
          later(() => setPops((p) => p.filter((x) => x !== id)), 900)
          thud()
        }, FLIGHT_MS)
      }, PRE_WORK_MS + i * THROW_GAP_MS)
    }
    // после последнего бревна проверяем, не пора ли начинать стройку нового уровня
    later(() => { setThrowing(false); advance() }, PRE_WORK_MS + (spend - 1) * THROW_GAP_MS + FLIGHT_MS + 250)
  }

  const beaverSrc = hidden ? spriteBuilder : cheer ? spriteCheer : sprite
  const talk = constructing
    ? SPEECH_AT_LEVEL[Math.min(SPEECH_AT_LEVEL.length - 1, Math.floor(cProg * SPEECH_AT_LEVEL.length))]
    : s.ready !== null ? 'Готово! Открывай'
      : speech ?? (!busy && lowHp ? 'Плотина течёт, помоги' : null)

  let btnText = `${next ? 'Построить' : 'Починить'} · ${spend} ${logWord(spend)}`
  if (constructing) btnText = 'Плотина строится'
  else if (s.ready !== null) btnText = 'Сначала открой плотину'
  else if (throwing) btnText = 'Бобёр работает'
  else if (!next && health >= 100) btnText = 'Плотина в порядке'
  else if (balance <= 0) btnText = 'Нет брёвен'

  const healthWord = health >= 70 ? 'Крепкая' : health >= 40 ? 'Есть трещины' : 'Течёт'

  return (
    <>
      <div className="space-y-3">
        <div ref={sceneRef} className="relative aspect-[4/3.3] overflow-hidden rounded-[24px] bg-[#9CC7F2]">
          <div ref={damRef} className="absolute inset-0">
            {hidden ? (
              <img src={damSrc(pending!)} alt="" draggable={false} className="dam-veil absolute inset-0 h-full w-full object-cover" />
            ) : (
              <>
                {revealing && <img src={damSrc(s.level)} alt="" draggable={false} className="dam-veil absolute inset-0 h-full w-full object-cover" />}
                <img
                  key={`${s.level}:${revealing}`}
                  src={damSrc(s.level)} alt={shownLevel.title} draggable={false}
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
                  <div className="mt-2 text-[13px] tabular-nums text-white/80">осталось {fmtLeft(s.buildEnd - t)}</div>
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

          {talk && (
            <div key={talk} className="anim-speech pointer-events-none absolute left-[30%] top-4 z-10 rounded-2xl rounded-bl-[6px] bg-white px-3 py-1.5 text-[13px] font-medium text-[#141416]">
              {talk}
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

          <div key={bump} className="anim-log absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#141416]" title="Брёвна на складе">
            <LogIcon size={15} />{balance}
          </div>

          {!hidden && (
            <div key={`chip:${s.level}`} className={`absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#141416] ${revealing ? 'chip-in' : ''}`}>
              Уровень {shownLevel.n} · {shownLevel.title}
            </div>
          )}
        </div>

        <Card>
          <div className="flex items-baseline justify-between">
            <div className="text-[15px] font-semibold text-mt-ink">{next ? `До уровня ${next.n}` : 'Все уровни пройдены'}</div>
            {next && <div className="text-[15px] font-semibold tabular-nums text-muted">{s.built} из {next.need}</div>}
          </div>
          <div className="mt-3"><Progress value={next ? s.built : 1} max={next ? next.need : 1} tone="brand" /></div>
          <div className="mt-2 text-[13px] text-muted">
            Сегодня получено {earnedToday} из {EARN_PER_DAY}
            {waiting > 0 ? `. Ещё ${waiting} ${logWord(waiting)} получишь завтра` : next ? `. Дальше: ${next.title.toLowerCase()}` : ''}
          </div>
        </Card>

        {s.level > 1 && !hidden && (
          <Card>
            <div className="flex items-baseline justify-between">
              <div className="text-[15px] font-semibold text-mt-ink">Прочность плотины</div>
              <div className={`text-[15px] font-semibold tabular-nums ${lowHp ? 'text-mt-red' : 'text-muted'}`}>{healthWord} · {Math.round(health)}%</div>
            </div>
            <div className="mt-3"><Progress value={health} max={100} tone={lowHp ? 'brand' : 'blue'} /></div>
            <div className="mt-2 text-[13px] text-muted">
              {health >= 100
                ? 'Плотина крепкая. Если долго не заходить, её начнёт размывать.'
                : `Без ремонта размоет через ${daysLeft} ${plural(daysLeft, 'день', 'дня', 'дней')}. Каждое бревно чинит на ${HEAL_PER_LOG}%.`}
            </div>
          </Card>
        )}

        <Btn onClick={build} disabled={busy || spend <= 0}>{btnText}</Btn>

        <button type="button" onClick={() => setHowTo(true)} className="mx-auto block text-[13px] font-medium text-muted underline-offset-2 hover:underline">
          Как получить брёвна
        </button>
      </div>

      <Sheet open={howTo} onClose={() => setHowTo(false)} title="Как получить брёвна">
        <Card className="divide-y divide-line p-0">
          <Row icon="target" iconTone="blue" title="Отложить в цель от 20 BYN" sub="1 бревно за каждые 5 BYN, бонус родителя тоже считается" />
          <Row icon="tasks" iconTone="blue" title="Выполнить задание" sub={`${LOGS_PER_TASK} ${logWord(LOGS_PER_TASK)}, когда родитель подтвердит`} />
          <Row icon="check" iconTone="blue" title="Достичь цели от 20 BYN" sub={`Ещё до ${GOAL_DONE_CAP} брёвен, по 1 за каждые 5 BYN цели`} />
          <Row icon="book" iconTone="blue" title="Пройти урок" sub={`${LOGS_PER_LESSON} ${logWord(LOGS_PER_LESSON)}`} />
        </Card>
        <p className="mt-3 text-[13px] text-muted">
          Брёвна нельзя купить, только заработать. Больше {EARN_PER_DAY} брёвен в день на склад не попадает, остальные ждут своей очереди. Класть их в плотину можно сколько угодно.
          Если {GRACE_DAYS} дня не заходить и не копить, плотина начнёт слабеть на {DECAY_PER_DAY}% в день. Когда прочность кончится, уровень упадёт на один, а часть брёвен унесёт река.
          Уложенные брёвна чинят плотину.
        </p>
      </Sheet>
    </>
  )
}
