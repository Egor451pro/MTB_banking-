import { useState } from 'react'
import { api } from '../api'
import { plural } from '../format'
import { useData } from '../hooks'
import { Btn, Card, Header, Loading, Note, Progress, Row, Section, Sheet, toast } from '../ui'

// Вкладка «Бобёр»: питомец строит плотину из брёвен.
// Брёвна ребёнок зарабатывает за реальные финансовые действия (их считаем из уже существующих данных:
// накопления в целях, подтверждённые задания, достигнутые цели, пройденные уроки). Купить брёвна нельзя.
// Потраченные на стройку брёвна пока хранятся в браузере; на бэкенд это переедет вместе с таблицей питомца.

const LOGS_PER_BUILD = 5
const LOGS_PER_5_BYN = 1
const LOGS_PER_TASK = 3
const LOGS_PER_GOAL_DONE = 20
const LOGS_PER_LESSON = 2

// need — сколько брёвен нужно уже построить, чтобы достичь уровня
export const DAM_LEVELS = [
  { n: 1, need: 0, title: 'Ручеёк' },
  { n: 2, need: 15, title: 'Первая плотина' },
  { n: 3, need: 40, title: 'Крепкая плотина' },
  { n: 4, need: 80, title: 'Плотина с домиком' },
]

const storageKey = (id: number) => `beaver:${id}`
function loadBuilt(id: number): number {
  try { return Number(localStorage.getItem(storageKey(id))) || 0 } catch { return 0 }
}
function saveBuilt(id: number, v: number) {
  try { localStorage.setItem(storageKey(id), String(v)) } catch { /* без хранилища просто не запоминаем */ }
}

function levelFor(built: number) {
  let lv = DAM_LEVELS[0]
  for (const l of DAM_LEVELS) if (built >= l.need) lv = l
  return lv
}

const logWord = (n: number) => plural(n, 'бревно', 'бревна', 'брёвен')

export function BeaverScreen({ meId }: { meId: number }) {
  const goals = useData(() => api.getGoals(meId), [meId], 3000)
  const tasks = useData(() => api.listTasks(), [], 3000)
  const lessons = useData(() => api.getLessons(), [], 3000)
  const [built, setBuilt] = useState(() => loadBuilt(meId))
  const [bump, setBump] = useState(0)
  const [levelUp, setLevelUp] = useState<number | null>(null)

  if (!goals.data || !tasks.data || !lessons.data) return <><Header title="Мой бобёр" /><Loading /></>

  const g = goals.data.items
  const fromGoals = g.reduce((s, x) => s + Math.floor(x.saved_cents / 500) * LOGS_PER_5_BYN + (x.status === 'done' ? LOGS_PER_GOAL_DONE : 0), 0)
  const fromTasks = tasks.data.items.filter((t) => t.status === 'confirmed').length * LOGS_PER_TASK
  const fromLessons = lessons.data.items.filter((l) => l.completed).length * LOGS_PER_LESSON
  const earned = fromGoals + fromTasks + fromLessons
  const balance = Math.max(0, earned - built)

  const level = levelFor(built)
  const next = DAM_LEVELS.find((l) => l.n === level.n + 1)

  const build = () => {
    const spend = Math.min(LOGS_PER_BUILD, balance)
    if (spend <= 0) return
    const before = levelFor(built).n
    const after = built + spend
    setBuilt(after)
    saveBuilt(meId, after)
    setBump((b) => b + 1)
    const lv = levelFor(after).n
    if (lv > before) setLevelUp(lv)
    else toast(`Бобёр положил ${spend} ${logWord(spend)} на плотину`)
  }

  const upLevel = DAM_LEVELS.find((l) => l.n === levelUp)

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
          {DAM_LEVELS.map((l) => (
            <img
              key={l.n} src={`/beaver/dam${l.n}.jpg`} alt={l.title} draggable={false}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
              style={{ opacity: l.n === level.n ? 1 : 0 }}
            />
          ))}
          <img
            src="/beaver/kid.png" alt="Бобёр" draggable={false}
            className="anim-bob absolute bottom-1 left-2 h-[62%] select-none drop-shadow-[0_6px_6px_rgba(0,0,0,0.18)]"
          />
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#2334C8]">
            Уровень {level.n} · {level.title}
          </div>
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

        <Btn onClick={build} disabled={balance <= 0}>
          {balance > 0 ? `Построить: положить ${Math.min(LOGS_PER_BUILD, balance)} ${logWord(Math.min(LOGS_PER_BUILD, balance))}` : 'Пока нет брёвен — заработай их ниже'}
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
              <img src="/beaver/kid.png" alt="" className="anim-bob absolute bottom-1 left-2 h-[62%]" />
            </div>
            <div className="text-sm text-muted">Плотина стала крепче. Копишь — растёшь!</div>
            <Btn onClick={() => setLevelUp(null)}>Отлично!</Btn>
          </div>
        )}
      </Sheet>
    </>
  )
}
