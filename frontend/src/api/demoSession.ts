// Код демо-песочницы: у каждого посетителя своя база на сервере (заголовок X-Demo-Session).
// Код берём из ссылки ?demo=код (так родитель и ребёнок открывают одну семью на двух телефонах),
// иначе из localStorage, иначе создаём случайный.
const KEY = 'mrk.demoSession'
const OK = /^[a-z0-9]{4,32}$/

let memory: string | null = null   // если браузер не даёт localStorage (приватный режим)

function readStored(): string | null {
  try { return localStorage.getItem(KEY) } catch { return memory }
}
function store(code: string) {
  memory = code
  try { localStorage.setItem(KEY, code) } catch { /* без хранилища код живёт до перезагрузки */ }
}
function random(): string {
  const a = new Uint8Array(6)
  try { crypto.getRandomValues(a) } catch { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256) }
  return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10)
}

function init(): string {
  try {
    const url = new URL(window.location.href)
    const fromUrl = (url.searchParams.get('demo') ?? '').trim().toLowerCase()
    if (OK.test(fromUrl)) {
      store(fromUrl)
      url.searchParams.delete('demo')
      window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash)
      return fromUrl
    }
  } catch { /* не браузер или странный URL — берём сохранённый код */ }
  const saved = readStored()
  if (saved && OK.test(saved)) return saved
  const code = random()
  store(code)
  return code
}

export const demoSession = { code: init() }

/** Ссылка, по которой другой телефон попадёт в ту же песочницу */
export const demoLink = () => `${window.location.origin}${window.location.pathname}?demo=${demoSession.code}`
