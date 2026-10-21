// Состояние бобра: уровень плотины, прочность, склад, таймер стройки.
// Хранится в браузере, поэтому у каждого ребёнка свой прогресс на этом устройстве.
// Время берём через now(): демо-панель умеет «прокрутить день» и ускорить стройку.

export const DAY = 86_400_000

export const DAM_LEVELS = [
  { n: 1, need: 0, title: 'Ручеёк' },
  { n: 2, need: 30, title: 'Первая плотина' },
  { n: 3, need: 80, title: 'Крепкая плотина' },
  { n: 4, need: 160, title: 'Плотина с домиком' },
]

export const PLACE_PER_DAY = 5          // сколько брёвен бобёр успевает уложить за день
export const GRACE_DAYS = 3             // столько дней без заходов плотина не страдает
export const DECAY_PER_DAY = 10         // потом прочность падает на столько процентов в день
export const HEAL_PER_LOG = 10          // каждое уложенное бревно чинит плотину
export const COLLAPSE_HP = 60           // прочность после размыва на уровень ниже
export const MIN_GOAL_CENTS = 2000      // цели меньше 20 BYN брёвен не дают
export const BUILD_MS: Record<number, number> = { 2: 30 * 60_000, 3: 3 * 3_600_000, 4: 12 * 3_600_000 }
export const FAST_BUILD_MS = 10_000

export const CHANGE_EVENT = 'beaver-change'
const OFFSET_KEY = 'beaver:offset'
const FAST_KEY = 'beaver:fast'
const stateKey = (id: number) => `beaver:${id}:s`

// Если браузер не даёт localStorage (приватный режим), держим данные в памяти до перезагрузки
const memory = new Map<string, string>()
function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return memory.get(key) ?? null }
}
function write(key: string, v: string) {
  try { localStorage.setItem(key, v) } catch { memory.set(key, v) }
}

const readNum = (key: string) => {
  const v = read(key)
  return v === null ? 0 : Number(v) || 0
}

export const now = () => Date.now() + readNum(OFFSET_KEY)
export const isFast = () => readNum(FAST_KEY) === 1
export const dayOf = (t: number) => Math.floor((t - new Date(t).getTimezoneOffset() * 60_000) / DAY)

export interface BeaverState {
  built: number               // брёвен в плотине
  level: number               // открытый уровень
  lost: number                // брёвен унесло рекой
  gift: number                // брёвна, выданные демо-панелью
  earnedSeen: number | null   // сколько брёвен заработано по данным (для поиска новой активности)
  buildTo: number | null      // уровень, который сейчас достраивается
  buildStart: number
  buildEnd: number
  ready: number | null        // достроено, ждёт открытия
  hp: number                  // прочность на момент lastActive
  lastActive: number
  day: number
  placed: number              // уложено брёвен в день `day`
}

export const levelFor = (built: number) => {
  let lv = DAM_LEVELS[0]
  for (const l of DAM_LEVELS) if (built >= l.need) lv = l
  return lv
}
export const levelByN = (n: number) => DAM_LEVELS.find((l) => l.n === n) ?? DAM_LEVELS[0]

export function freshState(t = now()): BeaverState {
  return {
    built: 0, level: 1, lost: 0, gift: 0, earnedSeen: null,
    buildTo: null, buildStart: 0, buildEnd: 0, ready: null,
    hp: 100, lastActive: t, day: dayOf(t), placed: 0,
  }
}

export function loadState(id: number): BeaverState {
  const base = freshState()
  try {
    const raw = read(stateKey(id))
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<BeaverState>) }
  } catch { /* битые данные — начинаем заново */ }
  return base
}

export function saveState(id: number, s: BeaverState) {
  write(stateKey(id), JSON.stringify(s))
}

/** Прочность на момент t: первые GRACE_DAYS дней без заходов ничего не меняется, потом −DECAY_PER_DAY в день */
export function healthAt(s: BeaverState, t: number): number {
  if (s.level <= 1) return 100
  const idle = Math.floor((t - s.lastActive) / DAY) - GRACE_DAYS
  return Math.max(0, Math.min(100, s.hp - DECAY_PER_DAY * Math.max(0, idle)))
}

/** Когда плотину размоет на уровень ниже, если не чинить */
export function collapseAt(s: BeaverState): number {
  return s.lastActive + (GRACE_DAYS + Math.ceil(s.hp / DECAY_PER_DAY)) * DAY
}

/** Двигает состояние к моменту t: заканчивает стройку, меняет день, размывает плотину, запускает новую стройку */
export function tickState(s: BeaverState, t = now()): { s: BeaverState; dropped: number } {
  const n = { ...s }
  let dropped = 0

  if (n.buildTo !== null && t >= n.buildEnd) { n.ready = n.buildTo; n.buildTo = null }

  const d = dayOf(t)
  if (d !== n.day) { n.day = d; n.placed = 0 }

  // Пока плотина строится или ждёт открытия, прочность стоит на месте
  if (n.buildTo !== null || n.ready !== null) {
    n.hp = healthAt(n, t)
    n.lastActive = Math.max(n.lastActive, t)
  } else {
    for (;;) {
      if (n.level <= 1) break
      const at = collapseAt(n)
      if (t < at) break
      const to = n.level - 1
      const keep = levelByN(to).need
      n.lost += Math.max(0, n.built - keep)
      n.built = keep
      n.level = to
      n.hp = COLLAPSE_HP
      n.lastActive = at
      dropped += 1
    }
  }

  const earned = levelFor(n.built).n
  if (earned > n.level && n.buildTo === null && n.ready === null) {
    n.buildTo = earned
    n.buildStart = t
    n.buildEnd = t + (isFast() ? FAST_BUILD_MS : (BUILD_MS[earned] ?? FAST_BUILD_MS))
  }
  return { s: n, dropped }
}

/** Новая заработанная активность (цель, задание, урок) останавливает отсчёт простоя */
export function noteEarned(s: BeaverState, total: number, t = now()): BeaverState {
  if (s.earnedSeen === total) return s
  if (s.earnedSeen !== null && total > s.earnedSeen) {
    return { ...s, earnedSeen: total, hp: healthAt(s, t), lastActive: t }
  }
  return { ...s, earnedSeen: total }
}

/** Что показывать на главной, в профиле и у родителя */
export function beaverInfo(childId: number) {
  const t = now()
  const { s } = tickState(loadState(childId), t)
  const next = DAM_LEVELS.find((l) => l.n === levelFor(s.built).n + 1)
  return {
    level: levelByN(s.level),
    built: s.built,
    next,
    health: healthAt(s, t),
    building: s.buildTo !== null || s.ready !== null,
  }
}

// ───────── Для демо-панели ─────────
function mutate(id: number, fn: (s: BeaverState, t: number) => BeaverState) {
  const t = now()
  saveState(id, fn(tickState(loadState(id), t).s, t))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export const demoActions = {
  setLevel(id: number, n: number) {
    mutate(id, (s, t) => {
      const need = levelByN(n).need
      return {
        ...s, level: n, built: need, buildTo: null, ready: null, hp: 100, lastActive: t,
        gift: Math.max(s.gift, need + s.lost - (s.earnedSeen ?? 0)),
      }
    })
  },
  addLogs(id: number, k: number) { mutate(id, (s) => ({ ...s, gift: s.gift + k })) },
  finishBuild(id: number) {
    mutate(id, (s, t) => (s.buildTo !== null ? { ...s, buildEnd: t } : s))
  },
  damage(id: number) { mutate(id, (s, t) => ({ ...s, hp: Math.min(30, healthAt(s, t)), lastActive: t })) },
  skipDay() {
    write(OFFSET_KEY, String(readNum(OFFSET_KEY) + DAY))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  },
  toggleFast(id: number) {
    const on = !isFast()
    write(FAST_KEY, on ? '1' : '0')
    if (on) mutate(id, (s, t) => (s.buildTo !== null ? { ...s, buildEnd: Math.min(s.buildEnd, t + FAST_BUILD_MS) } : s))
    else window.dispatchEvent(new Event(CHANGE_EVENT))
  },
  daysShifted: () => Math.round(readNum(OFFSET_KEY) / DAY),
}
