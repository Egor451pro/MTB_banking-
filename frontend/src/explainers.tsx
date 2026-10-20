import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from './icons'

// Анимированные мини-мультфильмы для уроков. Нарисованы кодом (SVG + CSS),
// работают без файлов и без генераторов видео. Герой — свой бобёр.

type Mood = 'happy' | 'sad' | 'calm'

const FUR = '#A66E3C'
const BELLY = '#EBCFA4'

function Beaver({ x, y, w, mood = 'happy', sweater = '#2F6FE4', flip = false, className = '' }: {
  x: number; y: number; w: number; mood?: Mood; sweater?: string; flip?: boolean; className?: string
}) {
  const mouth = mood === 'sad' ? 'M52 84 Q60 78 68 84' : mood === 'calm' ? 'M53 81 Q60 85 67 81' : 'M50 79 Q60 89 70 79'
  return (
    <svg x={x} y={y} width={w} height={w * 1.25} viewBox="0 0 120 150" className={className} overflow="visible">
      <g transform={flip ? 'translate(120 0) scale(-1 1)' : undefined}>
        <ellipse cx="98" cy="132" rx="21" ry="9" fill="#7A4A25" transform="rotate(-25 98 132)" />
        <path d="M28 150 C26 112 40 98 60 98 C80 98 94 112 92 150 Z" fill={sweater} />
        <ellipse cx="60" cy="99" rx="15" ry="5" fill="#fff" opacity=".35" />
        <circle cx="33" cy="42" r="10" fill={FUR} />
        <circle cx="87" cy="42" r="10" fill={FUR} />
        <circle cx="33" cy="42" r="5" fill="#D9A27A" />
        <circle cx="87" cy="42" r="5" fill="#D9A27A" />
        <ellipse cx="60" cy="64" rx="33" ry="31" fill={FUR} />
        <ellipse cx="60" cy="77" rx="21" ry="15" fill={BELLY} />
        <g className="ex-blink">
          <circle cx="47" cy="58" r="4.8" fill="#1B2430" />
          <circle cx="73" cy="58" r="4.8" fill="#1B2430" />
          <circle cx="48.6" cy="56.4" r="1.6" fill="#fff" />
          <circle cx="74.6" cy="56.4" r="1.6" fill="#fff" />
        </g>
        {mood === 'sad' && (
          <>
            <path d="M40 50 L53 47" stroke="#4A2D17" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M80 50 L67 47" stroke="#4A2D17" strokeWidth="2.4" strokeLinecap="round" />
          </>
        )}
        <ellipse cx="60" cy="69" rx="6.5" ry="4.4" fill="#3A2416" />
        <rect x="55.6" y="75" width="4.4" height="7" rx="1.2" fill="#fff" stroke="#D8C8AE" strokeWidth=".8" />
        <rect x="60.2" y="75" width="4.4" height="7" rx="1.2" fill="#fff" stroke="#D8C8AE" strokeWidth=".8" />
        <path d={mouth} stroke="#3A2416" strokeWidth="2" fill="none" strokeLinecap="round" />
        {mood === 'happy' && <><circle cx="38" cy="72" r="4.5" fill="#F19A8A" opacity=".5" /><circle cx="82" cy="72" r="4.5" fill="#F19A8A" opacity=".5" /></>}
      </g>
    </svg>
  )
}

function Sparkle({ x, y, d = 0, s = 1 }: { x: number; y: number; d?: number; s?: number }) {
  return (
    <path
      className="ex-twinkle" style={{ animationDelay: `${d}s` }}
      d={`M${x} ${y - 7 * s} L${x + 2 * s} ${y - 2 * s} L${x + 7 * s} ${y} L${x + 2 * s} ${y + 2 * s} L${x} ${y + 7 * s} L${x - 2 * s} ${y + 2 * s} L${x - 7 * s} ${y} L${x - 2 * s} ${y - 2 * s} Z`}
      fill="#FFC93C"
    />
  )
}

function Phone({ x, y, w = 70, children }: { x: number; y: number; w?: number; children?: ReactNode }) {
  const h = w * 1.9
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="11" fill="#1F2733" />
      <rect x="4" y="6" width={w - 8} height={h - 12} rx="8" fill="#fff" />
      {children}
    </g>
  )
}

// ── Сцены урока «Деньги закончились» ──
function S1() {
  return (
    <g>
      <rect x="170" y="108" width="120" height="58" rx="6" fill="#FFD9A8" />
      <path d="M160 108 L170 78 H290 L300 108 Z" fill="#fff" />
      {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${160 + i * 28} 108 L${170 + i * 24} 78 H${194 + i * 24} L${188 + i * 28} 108 Z`} fill={i % 2 ? '#fff' : '#E4414F'} />)}
      <circle cx="262" cy="136" r="10" fill="#F6B8D0" /><circle cx="262" cy="127" r="8" fill="#FFF3C4" />
      <path d="M254 140 L262 158 L270 140 Z" fill="#D9A25A" />
      <rect x="182" y="124" width="44" height="30" rx="5" fill="#2A3342" />
      <rect x="187" y="129" width="34" height="14" rx="2" fill="#D9E3F2" />
      <g className="ex-pop" style={{ animationDelay: '1.6s' }}>
        <circle cx="204" cy="136" r="7.5" fill="#E4002B" />
        <path d="M200.5 132.5 L207.5 139.5 M207.5 132.5 L200.5 139.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <Beaver x={40} y={42} w={92} mood="sad" />
      <g className="ex-card"><rect x="118" y="108" width="30" height="19" rx="3.5" fill="#2F6FE4" /><rect x="118" y="113" width="30" height="4" fill="#fff" opacity=".6" /></g>
    </g>
  )
}

function S2() {
  return (
    <g>
      <Beaver x={30} y={46} w={92} mood="sad" />
      <g className="ex-float">
        <circle cx="150" cy="52" r="5" fill="#fff" /><circle cx="164" cy="38" r="8" fill="#fff" />
        <rect x="170" y="14" width="46" height="30" rx="15" fill="#fff" />
        <text x="193" y="35" textAnchor="middle" fontSize="20" fontWeight="700" fill="#2B5FDB">?</text>
      </g>
      <Phone x={200} y={36} w={78}>
        <text x="39" y="38" fontSize="9" fill="#7A8594" transform="translate(0 0)">На карте</text>
        <text x="39" y="56" fontSize="15" fontWeight="700" fill="#14161A">0,50</text>
        <rect x="14" y="68" width="50" height="8" rx="4" fill="#E6EAF0" />
        <rect className="ex-bar" x="14" y="68" width="4" height="8" rx="4" fill="#E4002B" />
        <rect x="14" y="92" width="50" height="22" rx="7" fill="#EEF2F8" />
        <text x="39" y="107" textAnchor="middle" fontSize="8" fill="#7A8594">Лимит на сегодня</text>
      </Phone>
    </g>
  )
}

function S3() {
  return (
    <g>
      <circle className="ex-ring" cx="160" cy="100" r="40" fill="none" stroke="#2F6FE4" strokeWidth="2" />
      <circle className="ex-ring" style={{ animationDelay: '1.2s' }} cx="160" cy="100" r="40" fill="none" stroke="#6AA6F3" strokeWidth="2" />
      <g className="ex-breathe"><Beaver x={105} y={30} w={110} mood="calm" /></g>
      <text x="160" y="24" textAnchor="middle" fontSize="12" fill="#2B5FDB" fontWeight="700" opacity=".8">вдох… выдох…</text>
    </g>
  )
}

function S4() {
  return (
    <g>
      <Beaver x={36} y={42} w={92} mood="happy" />
      <Phone x={170} y={34} w={80}>
        <rect x="12" y="20" width="42" height="18" rx="9" fill="#EEF2F8" />
        <rect className="ex-msg" x="30" y="50" width="38" height="20" rx="10" fill="#2F6FE4" />
        <rect className="ex-msg" style={{ animationDelay: '.5s' }} x="20" y="78" width="48" height="20" rx="10" fill="#2F6FE4" />
        <text x="40" y="132" textAnchor="middle" fontSize="8" fill="#7A8594">Мама</text>
      </Phone>
      <path className="ex-up" d="M262 80 c-6 -8 -16 0 -8 8 l8 8 l8 -8 c8 -8 -2 -16 -8 -8 z" fill="#E4414F" />
    </g>
  )
}

function S5() {
  return (
    <g>
      <Beaver x={26} y={62} w={72} mood="happy" />
      <Beaver x={190} y={34} w={96} mood="happy" sweater="#E4414F" flip />
      <Phone x={134} y={40} w={64}>
        <rect className="ex-pulse" x="10" y="78" width="44" height="22" rx="11" fill="#2FB36A" />
        <path d="M24 90 L30 96 L42 84" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="10" y="40" width="44" height="26" rx="7" fill="#EEF2F8" />
        <text x="32" y="56" textAnchor="middle" fontSize="8" fill="#7A8594">Запрос</text>
      </Phone>
      <Sparkle x={128} y={34} s={1.1} /><Sparkle x={288} y={30} d={0.6} />
    </g>
  )
}

function S6() {
  return (
    <g>
      <circle cx="268" cy="38" r="20" fill="#FFD76A" /><circle cx="268" cy="38" r="26" fill="#FFD76A" opacity=".3" />
      <Beaver x={96} y={36} w={104} mood="happy" />
      <g className="ex-float">
        <path d="M205 112 L219 148 L233 112 Z" fill="#D9A25A" />
        <circle cx="219" cy="106" r="15" fill="#F6B8D0" /><circle cx="219" cy="90" r="12" fill="#FFF3C4" />
      </g>
      <Sparkle x={70} y={60} s={1.2} /><Sparkle x={246} y={84} d={0.5} /><Sparkle x={100} y={26} d={1} s={0.9} />
    </g>
  )
}

interface Explainer { scenes: (() => ReactNode)[]; captions: string[] }

const EXPLAINERS: Record<number, Explainer> = {
  5: {
    scenes: [S1, S2, S3, S4, S5, S6],
    captions: [
      'Ой! Покупку отклонили',
      'Может, не хватило денег или закончился дневной лимит',
      'Это нормально. Так бывает у всех',
      'Можно попросить родителя в приложении',
      'Решение всегда за родителем',
      'Спокойно попроси и дождись ответа',
    ],
  },
}

export const hasExplainer = (lessonId: number) => lessonId in EXPLAINERS

const SCENE_MS = 5500

export function ExplainerPlayer({ lessonId }: { lessonId: number }) {
  const ex = EXPLAINERS[lessonId]
  const [i, setI] = useState(0)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(true)
  const n = ex?.scenes.length ?? 0

  useEffect(() => {
    if (!playing) return
    const h = setInterval(() => setT((x) => x + 100), 100)
    return () => clearInterval(h)
  }, [playing])

  useEffect(() => {
    if (t < SCENE_MS) return
    if (i < n - 1) { setI(i + 1); setT(0) } else { setPlaying(false); setT(SCENE_MS) }
  }, [t, i, n])

  if (!ex) return null
  const Scene = ex.scenes[i]
  const finished = !playing && i === n - 1 && t >= SCENE_MS

  function toggle() {
    if (finished) { setI(0); setT(0); setPlaying(true) } else setPlaying((p) => !p)
  }

  return (
    <div className="relative overflow-hidden rounded-t-[20px] bg-[#DCEBFB]">
      <style>{CSS}</style>
      <svg viewBox="0 0 320 200" className="block aspect-video w-full" role="img" aria-label={ex.captions[i]}>
        <defs>
          <linearGradient id="exsky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#BFDCFB" /><stop offset="1" stopColor="#EAF3FD" />
          </linearGradient>
        </defs>
        <rect width="320" height="200" fill="url(#exsky)" />
        <rect y="160" width="320" height="40" fill="#CBE3D6" />
        <g key={i} className="ex-fade"><Scene /></g>
      </svg>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-4 pb-8 pt-8 text-center text-[15px] font-semibold leading-snug text-white">
        <span key={i} className="ex-fade inline-block">{ex.captions[i]}</span>
      </div>
      <div className="absolute inset-x-3 bottom-2.5 flex items-center gap-2">
        <button onClick={toggle} aria-label={finished ? 'Ещё раз' : playing ? 'Пауза' : 'Играть'} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#2B5FDB]">
          {finished ? <Icon name="refresh" size={15} /> : playing
            ? <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1" width="3" height="10" rx="1" fill="currentColor" /><rect x="7.5" y="1" width="3" height="10" rx="1" fill="currentColor" /></svg>
            : <Icon name="play" size={15} />}
        </button>
        <div className="flex flex-1 gap-1">
          {ex.scenes.map((_, k) => (
            <div key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/45">
              <div className="h-full bg-white" style={{ width: `${k < i ? 100 : k === i ? Math.min(100, (t / SCENE_MS) * 100) : 0}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const CSS = `
.ex-fade{animation:ex-fade .5s ease both}
.ex-pop{animation:ex-pop .45s cubic-bezier(.3,1.7,.5,1) both;transform-box:fill-box;transform-origin:center}
.ex-float{animation:ex-float 2.6s ease-in-out infinite}
.ex-breathe{animation:ex-breathe 2.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center bottom}
.ex-pulse{animation:ex-pulse 1.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.ex-blink{animation:ex-blink 4s infinite;transform-box:fill-box;transform-origin:center}
.ex-twinkle{animation:ex-twinkle 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.ex-ring{animation:ex-ring 2.4s ease-out infinite;transform-box:fill-box;transform-origin:center}
.ex-card{animation:ex-card 1.4s ease-in-out .3s both}
.ex-msg{animation:ex-msg .6s ease both}
.ex-up{animation:ex-up 2.4s ease-out infinite}
.ex-bar{animation:ex-bar 1.2s ease-out .4s both}
@keyframes ex-fade{from{opacity:0}to{opacity:1}}
@keyframes ex-pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes ex-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes ex-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes ex-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes ex-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes ex-twinkle{0%,100%{transform:scale(.5);opacity:.4}50%{transform:scale(1.1);opacity:1}}
@keyframes ex-ring{from{transform:scale(.6);opacity:.8}to{transform:scale(1.5);opacity:0}}
@keyframes ex-card{0%{transform:translate(0,0)}60%,100%{transform:translate(52px,6px)}}
@keyframes ex-msg{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes ex-up{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(-34px);opacity:0}}
@keyframes ex-bar{from{width:50px}to{width:4px}}
@media (prefers-reduced-motion:reduce){.ex-float,.ex-breathe,.ex-pulse,.ex-blink,.ex-twinkle,.ex-ring,.ex-up{animation:none}}
`
