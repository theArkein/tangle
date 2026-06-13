'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import WordPill from '@/components/ui/WordPill'
import TimerBar from '@/components/ui/TimerBar'
import GameToast, { type ToastVariant, TOAST_DURATION } from '@/components/ui/GameToast'
import GameKeyboard from '@/components/ui/GameKeyboard'
import { useSoundEngine } from '@/hooks/useSoundEngine'
import { POWER_UP_LABELS, POWER_UP_GUIDE, type PowerUpId } from '@/lib/powerups'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// ── Backend types (mirrored from src/modules/MatchStateMachine.ts) ───────────

type PowerUpInventory = Record<PowerUpId, number>
type GameMode = 'duel' | 'classic'

type ActiveEffect =
  | { kind: 'letterBomb'; onPlayerId: string; anyRareLetter: true }
  | { kind: 'doubleScore'; forPlayerId: string; wordsRemaining: number }
  | { kind: 'wildPending'; forPlayerId: string }
  | { kind: 'anchor'; onPlayerId: string; minLength: number }

interface DropTriggers {
  playerFreezeThresholds: Record<string, number>
  playerWordCounts: Record<string, number>
}

interface RoundState {
  roundNumber: number
  seedLetter: string
  chain: string[]
  currentPlayerId: string
  roundWinnerId?: string
  playerRoundScores: Record<string, number>
  powerUpInventory: Record<string, PowerUpInventory>
  activeEffects: ActiveEffect[]
  dropTriggers: DropTriggers
}

interface RoundEndContext {
  roundNumber: number
  winnerId: string
  nextRoundConfirmations: string[]
}

interface MatchState {
  status: 'waiting' | 'round_active' | 'round_complete' | 'match_complete'
  player1Id: string
  player2Id: string
  roundWins: Record<string, number>
  gameMode: GameMode
  currentRound?: RoundState
  roundEndContext?: RoundEndContext
  matchWinnerId?: string
}

interface WordEntry {
  word: string
  playerId: string
  points: number
  breakdown: { base: number; rareTier1: number; rareTier2: number; rareTier3: number; longWord: number }
}

interface RoundHistoryEntry {
  roundNumber: number
  winnerId: string
  words: WordEntry[]
}

type ServerMsg =
  | { type: 'state_update'; state: MatchState; scores: Record<string, number>; roundHistory: RoundHistoryEntry[]; turnStartAt?: number; serverNow?: number; dangerZoneEnabled?: boolean }
  | { type: 'waiting'; playerCount: number; mode?: GameMode }
  | { type: 'word_result'; valid: true; points: number; breakdown: { base: number; rareTier1: number; rareTier2: number; rareTier3: number; longWord: number }; multiplier?: number }
  | { type: 'word_result'; valid: false; reason: string }
  | { type: 'opponent_disconnected' }
  | { type: 'rematch_pending' }
  | { type: 'rematch_timeout' }
  | { type: 'power_up_earned'; playerId: string; powerup: PowerUpId }
  | { type: 'danger_zone_entered' }
  | { type: 'power_up_activated'; powerup: PowerUpId; byPlayerId: string; targetPlayerId: string | null; effect?: ActiveEffect | null }
  | { type: 'second_life_consumed'; playerId: string }
  | { type: 'reaction'; fromPlayerId: string; reaction: string }
  | { type: 'forfeit'; absentPlayerId: string }
  | { type: 'error'; message: string }

// ── Constants ────────────────────────────────────────────────────────────────

const NEXT_ROUND_SECONDS = 30

const TEST_CHAIN_100 = [
  'tangle','lethal','alone','never','erase','serum','rummy','mystic',
  'iconic','iceberg','rgolem','element','eternal','allied','edible',
  'legend','darkly','lyric','icicle','lemon','onward','define',
  'enact','actual','almond','dental','almost','stitch','chime',
  'mellow','owing','ingest','stolen','enough','ghost','thrive',
  'valley','yeoman','anklet','target','ethics','chosen','energy',
  'gypsum','margin','insane','nectar','arcade','decide','cello',
  'lofty','typhon','online','leapt','preach','chrome','melee',
  'elder','derive','velvet','terror','roving','ingot','obtain',
  'inward','arden','newt','twitch','chimera','rabbit','biting',
  'glory','wyvern','noble','endow','witch','chasm','smell',
  'llama','malted','deluge','gentle','elbow','omega','gavel',
  'elfish','hidden','denser','reform','format','atoll','llano',
  'noodle','leaden','dagger','gravel','elvish','shine','nettle',
  'lunge','geode','denim','nimble','abolish','harbor','rabbit',
  'tacos','stealth','handle','effort','typical','kayak','kindle',
  'expert','tribal','listen','tuxedo','oxygen','yellow','eggplant',
  'thread','declare','engine','ending','gotten','tenant','terrific',
  'cable','elf','fallen','nature','energy','yacht','taxicab',
  'bulge','engine','explore','expert','extend','effect','erase',
  'finish','friend','forest','forget','format','frozen','galaxy',
  'gather','gentle','global','glance','golden','govern','gravel',
  'gravity','ground','growth','guided','guitar','handle','happen',
  'harbor','harden','health','heaven','hidden','higher','honest',
  'horror','humble','hungry','hurdle','hybrid','ignore','impact',
  'import','income','inform','inject','injury','insect','insert',
  'inside','intent','invoke','island','jacket','jingle','juggle',
  'jungle','kernel','kettle','kidnap','kindle','knight','ladder',
  'ladies','landed','laptop','lately','latest','leader','league',
  'leaked','learn','legacy','legend','length','lesson','letter',
  'liable','liberty','lifted','lights','likely','listen','little',
  'living','locate','locked','london','longer','looked','losing',
  'louder','loving','lovely','lowest','luxury','machine','madness',
  'magnet','maiden','mainly','making','manage','manner','manual',
  'marble','margin','marked','market','marvel','master','matter',
  'meadow','median','medium','melody','member','memory','mental',
  'mentor','merger','merely','method','middle','mighty','minute',
  'mirror','misery','missed','mobile','modern','modest','moment',
  'monkey','monster','monthly','mortal','mostly','mother','motion',
  'moving','murder','muscle','museum','mutual','mystery','myself',
  'naming','narrow','nation','native','nature','nearby','nearly',
  'nearly','nectar','needed','needle','nephew','nerves','nested',
  'neural','newest','nickel','nights','nobody','normal','notice',
  'notion','number','nurse','object','oblate','obtain','obvious',
  'occupy','occurs','ocean','office','offset','online','operate',
  'opines','option','oracle','orange','orchard','orders','organs',
  'origin','others','outfit','output','output','outrage','owning',
  'oxygen','oyster','packed','paddle','pained','paired','palace',
  'panels','parent','parish','parks','parrot','partly','passed',
  'patent','patrol','patron','paused','paving','paying','peace',
  'peaker','pearl','pebble','pedal','pencil','penny','people',
  'pepper','perfect','perform','perhaps','period','permit','person',
  'peruse','petals','phrase','picked','picnic','picture','pierce',
  'pigeon','pigment','pillage','pillow','pinned','pirate','pistol',
  'pitcher','placed','plague','placed','planet','plants','plastic',
  'plates','played','player','plaza','please','pledge','plenty',
  'plight','pliers','plight','plowed','plunge','pocket','poem',
  'poetry','pointed','poison','policy','polish','polite','pompous',
  'ponies','pooled','poorer','poorly','popped','popular','porch',
  'portal','porter','posed','posse','postal','posted','potato',
  'potent','potion','potter','pounds','poured','poverty','powder',
  'power','praise','prayed','prayer','preach','precedes','precise',
  'preface','prefer','prefix','prepay','present','pretend','pretty',
  'prevail','prevent','preview','previous','preying','priced','pried',
  'priest','primes','prince','print','prison','private','probable',
  'problem','proceed','process','produce','product','profane','profile',
  'profits','program','project','promise','promote','prompt','prompt',
  'prone','proof','proper','propose','protect','protest','proving',
  'provoke','prowess','prowl','public','pulled','pulley','pulped',
  'pulsed','pumped','punched','punish','puppet','pupils','purchase',
  'purged','purify','purple','purpose','pursued','pushing','puzzle',
  'pyramid','quaint','quaked','quarry','quarter','quarts','quartz',
  'quashed','queasy','queens','queries','quest','question','queue',
  'quiche','quick','quiet','quilts','quirks','quiz','quoted',
  'quotes','rabbid','rabbit','rabies','raced','racket','radial',
  'radiant','radical','radius','rafted','ragged','raider','railed',
  'rained','raised','raisins','raking','rallied','rammed','rampage',
  'rampant','ramps','random','ranged','ranger','ranked','ransack',
  'ranted','rapids','rarest','rarity','rasped','rather','ratify',
  'rating','rattle','ravage','raveled','ravine','ravings','ravish',
  'razors','reached','reacted','reactor','readers','readily','realism',
  'reality','realms','reaped','reaper','rearing','reason','rebate',
  'rebuild','rebuke','recall','recant','recap','recedes','receipt',
  'receive','recent','recess','recipe','recited','recite','reckless',
  'reckon','recline','recluse','recoil','record','records','recount',
  'recover','recruit','rectify','recycle','redeem','reeked','reeled',
  'reeves','refect','refill','refine','refire','reflex','reflux',
  'reform','refrain','refund','refusal','regain','regal','regime',
  'region','register','regress','regret','regular','rehash','rehire',
  'reigns','reimpose','reindeer','reinvent','reject','rejoice','rejoin',
  'rejuvenate','relapse','relate','relaxed','relayed','release','relent',
  'reliant','relic','relief','relieve','religion','relish','relive',
  'reload','relocate','reluctant','remain','remark','remedy','remember',
  'remind','remise','remiss','remit','remnant','remodel','remorse',
  'remote','removal','remove','render','renege','renew','renown',
  'rental','repair','repast','repay','repeal','repeat','repel',
  'repent','replace','replete','replica','replied','report','repose',
  'reprise','reprobe','reproof','reprove','repulse','repute','request',
  'require','requite','rescind','rescue','reseal','research','resemble',
  'resent','reserve','reside','residue','resign','resilience','resin',
  'resist','resolve','resonate','resound','resource','respect','respire',
  'respite','respond','response','rest','restful','restitution','restive',
  'restore','restrain','restrict','result','resume','resurge','resurrect',
  'retail','retain','retard','retch','rethink','reticent','retina',
  'retire','retort','retrace','retract','retreat','retrieve','return',
  'reunite','reuse','reveal','revel','revenge','revenue','reverb',
  'revere','reverse','revert','review','revile','revise','revisit',
  'revive','revoke','revolved','revolver','revue','revulsion','reward',
  'reword','rework','rhetoric','rhino','rhythm','ribbon','riches',
  'rickets','rickety','ricochet','riddance','riddle','ridden','riddle',
  'riding','rife','riffle','rifle','rift','rigged','rigger',
]

const MODE_CONFIG: Record<GameMode, { displayName: string; turnSeconds: number }> = {
  duel: { displayName: 'Duel', turnSeconds: 25 },
  classic: { displayName: 'Classic', turnSeconds: 8 },
}

const REACTION_OPTIONS: Array<{ key: string; emoji: string }> = [
  { key: 'fire', emoji: '🔥' },
  { key: 'shocked', emoji: '😱' },
  { key: 'clap', emoji: '👏' },
  { key: 'skull', emoji: '💀' },
]
const POWER_DESC = Object.fromEntries(
  POWER_UP_GUIDE.map(e => [e.id, { own: e.description, opp: e.opponentDescription }])
) as Record<PowerUpId, { own: string; opp: string }>

function PowerUpTooltip({ id, description, children, onActivate, disabled }: { id: PowerUpId; description: string; children: React.ReactNode; onActivate?: () => void; disabled?: boolean }) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [longPressActive, setLongPressActive] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getAnchorPos = () => {
    if (!ref.current) return null
    const r = ref.current.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top }
  }

  const tooltipNode = anchor ? (
    <span style={{
      position: 'fixed',
      top: anchor.y - 7,
      left: anchor.x,
      transform: 'translate(-50%, -100%)',
      background: 'var(--n900)',
      color: 'var(--n0)',
      padding: '6px 9px',
      borderRadius: 7,
      fontSize: 11,
      lineHeight: 1.4,
      width: 170,
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: 9999,
      boxShadow: '0 3px 10px rgba(0,0,0,0.30)',
    } as React.CSSProperties}>
      <strong style={{ display: 'block', fontSize: 13, marginBottom: 3 }}>{POWER_UP_LABELS[id].emoji} {POWER_UP_LABELS[id].name}</strong>
      {description}
      <span style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid var(--n900)' }} />
    </span>
  ) : null

  if (onActivate !== undefined) {
    // Mobile-first: long-press → tooltip, short tap → activate
    return (
      <span
        ref={ref}
        style={{ position: 'relative', display: 'inline-flex' }}
        onPointerDown={e => {
          e.preventDefault()
          timerRef.current = setTimeout(() => {
            setLongPressActive(true)
            setAnchor(getAnchorPos())
          }, 500)
        }}
        onPointerUp={() => {
          if (timerRef.current) clearTimeout(timerRef.current)
          if (!longPressActive && !disabled) onActivate()
          setLongPressActive(false)
          setAnchor(null)
        }}
        onPointerLeave={() => {
          if (timerRef.current) clearTimeout(timerRef.current)
          setLongPressActive(false)
          setAnchor(null)
        }}
        onMouseEnter={() => { if (!longPressActive) setAnchor(getAnchorPos()) }}
        onMouseLeave={() => { if (!longPressActive) setAnchor(null) }}
      >
        {children}
        {tooltipNode}
      </span>
    )
  }

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setAnchor(getAnchorPos())}
      onMouseLeave={() => setAnchor(null)}
    >
      {children}
      {tooltipNode}
    </span>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  shell: { display: 'flex', justifyContent: 'center', alignItems: 'stretch', height: '100dvh', width: '100%', overflow: 'hidden', overscrollBehavior: 'none' } as React.CSSProperties,
  page: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative', overflow: 'hidden', overscrollBehavior: 'none', background: 'var(--n50)', color: 'var(--n800)' } as React.CSSProperties,
  centeredFull: { display: 'flex', flexDirection: 'column', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '20px', textAlign: 'center' } as React.CSSProperties,
  header: { background: 'var(--n0)', borderBottom: '1px solid var(--n200)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' } as React.CSSProperties,
  scoreText: { fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--n800)' } as React.CSSProperties,
  sectionLabel: { fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n400)' } as React.CSSProperties,
  bottomPanel: { background: 'var(--n0)', borderTop: '1px solid var(--n200)', padding: '12px 16px 20px' } as React.CSSProperties,
  input: { flex: 1, border: '1px solid var(--n200)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: '15px', fontFamily: 'var(--font-body)', color: 'var(--n900)', outline: 'none', minWidth: 0, background: 'var(--n0)' } as React.CSSProperties,
} as const

// ── Game screen ──────────────────────────────────────────────────────────────

function GameContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const roomId = searchParams.get('room') ?? ''
  const devMode = searchParams.get('mode') === 'dev'

  const [myId, setMyId] = useState<string | null>(null)
  const [googleLinked, setGoogleLinked] = useState(false)
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [waitingCount, setWaitingCount] = useState<number | null>(null)
  const [disconnected, setDisconnected] = useState(false)
  const [wordInput, setWordInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [floats, setFloats] = useState<Array<{ id: number; text: string; ok: boolean; byMe: boolean }>>([])
  const floatIdRef = useRef(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [nextRoundTimeLeft, setNextRoundTimeLeft] = useState(NEXT_ROUND_SECONDS)
  const [roundHistory, setRoundHistory] = useState<RoundHistoryEntry[]>([])
  const [gameScores, setGameScores] = useState<Record<string, number>>({})
  const [rematchState, setRematchState] = useState<'idle' | 'pending'>('idle')
  const [dangerZoneEnabled, setDangerZoneEnabled] = useState(false)
  const [showLinkPrompt, setShowLinkPrompt] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [myHighlights, setMyHighlights] = useState<Partial<Record<PowerUpId, 'earned' | 'activated'>>>({})
  const [oppHighlights, setOppHighlights] = useState<Partial<Record<PowerUpId, 'earned' | 'activated'>>>({})
  const [reactionFeed, setReactionFeed] = useState<Array<{ id: number; emoji: string; byMe: boolean }>>([])
  const [forfeitedBy, setForfeitedBy] = useState<string | null>(null)
  const [powerFloats, setPowerFloats] = useState<Array<{ id: number; emoji: string; side: 'mine' | 'opp'; x: number | null; y: number | null }>>([])
  const powerFloatIdRef = useRef(0)

  const [isMobile, setIsMobile] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(true)
  const [activeToast, setActiveToast] = useState<{ id: number; variant: ToastVariant; subText?: string; title?: string } | null>(null)
  const toastIdRef = useRef(0)
  const [reactionsOpen, setReactionsOpen] = useState(false)

  const { play, muted, setMuted } = useSoundEngine()
  const playRef = useRef(play)
  useEffect(() => { playRef.current = play }, [play])
  useEffect(() => { setIsMobile(navigator.maxTouchPoints > 0) }, [])

  // Mock game state for dev testing — enable with ?mode=dev (no room parameter)
  useEffect(() => {
    if (typeof window === 'undefined' || !devMode || roomId) return
    const P1 = 'test-p1', P2 = 'test-p2'
    setMyId(P1)
    setMatchState({
      status: 'round_active',
      player1Id: P1,
      player2Id: P2,
      roundWins: { [P1]: 1, [P2]: 0 },
      gameMode: 'duel',
      currentRound: {
        roundNumber: 2,
        seedLetter: 't',
        chain: TEST_CHAIN_100,
        currentPlayerId: P1,
        playerRoundScores: { [P1]: 312, [P2]: 187 },
        powerUpInventory: {
          [P1]: { extend: 2, secondLife: 1, letterBomb: 1, double: 1, wild: 1, anchor: 1, tax: 0 },
          [P2]: { extend: 1, secondLife: 1, letterBomb: 0, double: 2, wild: 0, anchor: 1, tax: 1 },
        },
        activeEffects: [
          { kind: 'letterBomb', onPlayerId: P1, anyRareLetter: true },
        ],
        dropTriggers: { playerFreezeThresholds: { [P1]: 10, [P2]: 10 }, playerWordCounts: { [P1]: 0, [P2]: 0 } },
      },
    })
    setGameScores({ [P1]: 1, [P2]: 0 })
    setDangerZoneEnabled(true)
  }, [roomId, devMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (submitting) return
    if (matchState?.currentRound?.currentPlayerId === myId) {
      inputRef.current?.focus()
    }
  }, [matchState?.currentRound?.currentPlayerId, myId, submitting])

  // Keep focus on input whenever it's my turn — even if user clicks elsewhere
  useEffect(() => {
    const isMyTurn = matchState?.currentRound?.currentPlayerId === myId
    if (!isMyTurn || submitting) return
    const handler = () => { setTimeout(() => inputRef.current?.focus(), 0) }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [matchState?.currentRound?.currentPlayerId, myId, submitting])

  useEffect(() => {
    if (!activeToast) return
    const id = setTimeout(() => setActiveToast(null), TOAST_DURATION)
    return () => clearTimeout(id)
  }, [activeToast?.id])

  const wsRef = useRef<WebSocket | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chainScrollRef = useRef<HTMLDivElement>(null)
  const deferredInstallRef = useRef<BeforeInstallPromptEvent | null>(null)
  const prevStateRef = useRef<MatchState | null>(null)

  const turnStartAtRef = useRef(0)
  const nextRoundStartedAtRef = useRef(0)
  const reactionIdRef = useRef(0)
  const inDangerZoneRef = useRef(false)


  // Load current player ID
  useEffect(() => {
    if (!roomId) return
    fetch('/api/me')
      .then(r => r.json())
      .then((d: { id: string; google_linked: boolean }) => { setMyId(d.id); setGoogleLinked(d.google_linked) })
      .catch(() => {})
  }, [roomId])

  // Open WebSocket once we know the player ID
  useEffect(() => {
    if (!myId || !roomId) return

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = process.env.NODE_ENV === 'development' ? `${window.location.hostname}:8787` : window.location.host
    const wsUrl = `${proto}//${wsHost}/api/rooms/${roomId}/ws`
    console.log('[ws] connecting to', wsUrl)
    const ws = new WebSocket(wsUrl)
    ws.onopen = () => console.log('[ws] opened')
    ws.onerror = (e) => console.log('[ws] error', e.type)
    ws.onclose = (e) => console.log('[ws] closed code=' + e.code)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      let msg: ServerMsg
      try {
        msg = JSON.parse(ev.data as string) as ServerMsg
      } catch {
        return
      }

      if (msg.type === 'waiting') {
        setWaitingCount(msg.playerCount)
        return
      }

      if (msg.type === 'opponent_disconnected') {
        setDisconnected(true)
        ws.close()
        return
      }

      if (msg.type === 'rematch_pending') {
        setRematchState('pending')
        return
      }

      if (msg.type === 'rematch_timeout') {
        router.push('/')
        return
      }

      if (msg.type === 'word_result') {
        setSubmitting(false)
        if (msg.valid) {
          setWordInput('')
          const id = ++floatIdRef.current
          setFloats(prev => [...prev, { id, text: `+${msg.points}`, ok: true, byMe: true }])
          setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 2000)
          playRef.current('word_valid')
        } else {
          const id = ++floatIdRef.current
          setFloats(prev => [...prev, { id, text: msg.reason ?? 'Invalid', ok: false, byMe: true }])
          setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 2000)
          setActiveToast({ id: ++toastIdRef.current, variant: 'error', subText: msg.reason })
          playRef.current('word_invalid')
        }
        return
      }

      if (msg.type === 'power_up_earned') {
        const isMe = msg.playerId === myId
        const setter = isMe ? setMyHighlights : setOppHighlights
        setter(h => ({ ...h, [msg.powerup]: 'earned' }))
        setTimeout(() => setter(h => { const n = { ...h }; delete n[msg.powerup]; return n }), 1500)
        const pLabel = POWER_UP_LABELS[msg.powerup]
        const fid = ++powerFloatIdRef.current
        const side: 'mine' | 'opp' = isMe ? 'mine' : 'opp'
        // Each player's float rises from their own top inventory icon for that power-up
        const anchorEl = isMe
          ? document.querySelector(`[data-float="top-mine-${msg.powerup}"]`)
          : document.querySelector(`[data-float="opp-${msg.powerup}"]`)
        let fx: number | null = null, fy: number | null = null
        if (anchorEl) {
          const r = anchorEl.getBoundingClientRect()
          fx = r.left + r.width / 2
          fy = r.bottom
        }
        setPowerFloats(prev => [...prev, { id: fid, emoji: pLabel?.emoji ?? '', side, x: fx, y: fy }])
        setTimeout(() => setPowerFloats(prev => prev.filter(f => f.id !== fid)), 1100)
        playRef.current(isMe ? 'power_earned' : 'opp_turn')
        return
      }

      if (msg.type === 'power_up_activated') {
        const isMe = msg.byPlayerId === myId
        const setter = isMe ? setMyHighlights : setOppHighlights
        setter(h => ({ ...h, [msg.powerup]: 'activated' }))
        setTimeout(() => setter(h => { const n = { ...h }; delete n[msg.powerup]; return n }), 1000)
        // Only toast when I'm the target (opponent used something on me).
        // letterBomb/anchor are surfaced by the persistent effect bar, so skip the toast for those.
        if (!isMe && msg.targetPlayerId === myId && msg.powerup !== 'letterBomb' && msg.powerup !== 'anchor') {
          const pLabel2 = POWER_UP_LABELS[msg.powerup]
          setActiveToast({ id: ++toastIdRef.current, variant: 'error', title: `${pLabel2?.emoji ?? ''} ${pLabel2?.name ?? msg.powerup}` })
        }
        playRef.current(isMe ? 'power_used_me' : 'power_used_opp')
        return
      }

      if (msg.type === 'second_life_consumed') {
        const isMe = msg.playerId === myId
        const setter = isMe ? setMyHighlights : setOppHighlights
        setter(h => ({ ...h, secondLife: 'activated' }))
        setTimeout(() => setter(h => { const n = { ...h }; delete n.secondLife; return n }), 1000)
        playRef.current(isMe ? 'power_used_me' : 'power_used_opp')
        return
      }

      if (msg.type === 'reaction') {
        const found = REACTION_OPTIONS.find(r => r.key === msg.reaction)
        const emoji = found?.emoji ?? '👍'
        const id = ++reactionIdRef.current
        setReactionFeed(prev => [...prev, { id, emoji, byMe: msg.fromPlayerId === myId }])
        setTimeout(() => {
          setReactionFeed(prev => prev.filter(r => r.id !== id))
        }, 3000)
        return
      }

      if (msg.type === 'danger_zone_entered') {
        setActiveToast({ id: ++toastIdRef.current, variant: 'danger_zone' })
        playRef.current('danger_zone')
        return
      }

      if (msg.type === 'forfeit') {
        setForfeitedBy(msg.absentPlayerId)
        return
      }

      if (msg.type === 'state_update') {
        const { state } = msg
        const prev = prevStateRef.current
        const prevRound = prev?.currentRound
        const newRound = state.currentRound

        if (state.status === 'match_complete') {
          setRematchState('idle')
        }

        if (state.status === 'round_complete' && prev?.status !== 'round_complete') {
          nextRoundStartedAtRef.current = Date.now()
          setNextRoundTimeLeft(NEXT_ROUND_SECONDS)
        }

        if (newRound) {
          const chainGrew = newRound.chain.length > (prevRound?.chain.length ?? -1)
          const roundChanged = newRound.roundNumber !== prevRound?.roundNumber
          const firstUpdate = !prevRound
          if (msg.turnStartAt != null && msg.serverNow != null) {
            const serverElapsed = msg.serverNow - msg.turnStartAt
            turnStartAtRef.current = Date.now() - serverElapsed
          } else if (chainGrew || roundChanged || firstUpdate) {
            turnStartAtRef.current = Date.now()
          }
          if (chainGrew && prevRound && prevRound.currentPlayerId !== myId) {
            const oppId = state.player1Id === myId ? state.player2Id : state.player1Id
            const diff = (newRound.playerRoundScores[oppId] ?? 0) - (prevRound.playerRoundScores[oppId] ?? 0)
            if (diff > 0) {
              const id = ++floatIdRef.current
              setFloats(prev => [...prev, { id, text: `+${diff}`, ok: true, byMe: false }])
              setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 2000)
            }
          }
        }

        prevStateRef.current = state
        setRoundHistory(msg.roundHistory ?? [])
        setGameScores(msg.scores ?? {})
        setWaitingCount(null)
        setMatchState(state)
        setSubmitting(false)
        if (msg.dangerZoneEnabled != null) setDangerZoneEnabled(msg.dangerZoneEnabled)
        return
      }
    }

    ws.onerror = () => setDisconnected(true)

    return () => ws.close()
  }, [myId, roomId, router])

  // Visual countdown ticker — updates every 250 ms
  // Use DZ-aware max: DZ timeout is always 10s regardless of game mode
  const DZ_TIMER_SECS = 10
  const currentChainLength = matchState?.currentRound?.chain.length ?? 0
  const currentlyInDZ = dangerZoneEnabled && currentChainLength >= 12
  const timerMaxSecs = currentlyInDZ ? DZ_TIMER_SECS : (MODE_CONFIG[matchState?.gameMode ?? 'duel'].turnSeconds)
  useEffect(() => {
    if (matchState?.status !== 'round_active') return
    const maxSecs = timerMaxSecs
    const calc = () => Math.max(0, maxSecs - (Date.now() - turnStartAtRef.current) / 1000)
    setTimeLeft(calc())
    const id = setInterval(() => setTimeLeft(calc()), 250)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState?.status, matchState?.gameMode, timerMaxSecs, matchState?.currentRound?.currentPlayerId])

  // Next-round countdown ticker
  useEffect(() => {
    if (matchState?.status !== 'round_complete') return
    const id = setInterval(() => {
      setNextRoundTimeLeft(Math.max(0, NEXT_ROUND_SECONDS - (Date.now() - nextRoundStartedAtRef.current) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [matchState?.status])

  // Auto-scroll chain to the latest word (bottom) whenever chain grows
  useEffect(() => {
    const el = chainScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [matchState?.currentRound?.chain.length])

  // Sound: turn change
  const prevTurnPlayerRef = useRef<string | null>(null)
  useEffect(() => {
    if (!matchState?.currentRound || !myId) return
    const curr = matchState.currentRound.currentPlayerId
    if (prevTurnPlayerRef.current !== null && curr !== prevTurnPlayerRef.current) {
      playRef.current(curr === myId ? 'turn_start' : 'opp_turn')
    }
    prevTurnPlayerRef.current = curr
  }, [matchState?.currentRound?.currentPlayerId, myId])

  // Sound: round/match end
  const prevStatusRef = useRef<string | null>(null)
  useEffect(() => {
    if (!matchState) return
    const s = matchState.status
    if (s !== prevStatusRef.current) {
      if (s === 'round_complete') playRef.current('round_win')
      if (s === 'match_complete') playRef.current(matchState.matchWinnerId === myId ? 'match_win' : 'round_win')
    }
    prevStatusRef.current = s
  }, [matchState?.status, matchState?.matchWinnerId, myId])

  // Sound: time warn
  const timeWarnFiredRef = useRef(false)
  useEffect(() => {
    if (matchState?.status !== 'round_active') { timeWarnFiredRef.current = false; return }
    const warnAt = inDangerZoneRef.current ? 3 : 5
    if (timeLeft > 0 && timeLeft <= warnAt && !timeWarnFiredRef.current) {
      timeWarnFiredRef.current = true
      playRef.current('time_warn')
      setActiveToast({ id: ++toastIdRef.current, variant: 'time_warn', title: `${warnAt} seconds left!` })
    }
    if (timeLeft > warnAt) timeWarnFiredRef.current = false
  }, [timeLeft, matchState?.status])

  const submitWord = useCallback(() => {
    const word = wordInput.trim().toLowerCase()
    if (!word || submitting || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'submit_word', word }))
    setSubmitting(true)
  }, [wordInput, submitting])

  const handleGameKey = useCallback((key: string) => {
    if (key === 'ENTER') { submitWord(); return }
    setWordInput(prev => key === 'BACKSPACE' ? prev.slice(0, -1) : prev + key.toLowerCase())
  }, [submitWord])

  const sendNextRoundRequest = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'next_round_request' }))
  }, [])

  const activatePowerUp = useCallback((id: PowerUpId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'use_powerup', powerup: id }))
  }, [])

  const sendReaction = useCallback((reaction: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'send_reaction', reaction }))
    playRef.current('reaction')
  }, [])

  // Auto-rematch for bot matches
  useEffect(() => {
    if (matchState?.status !== 'match_complete' || !myId) return
    const opId = matchState.player1Id === myId ? matchState.player2Id : matchState.player1Id
    if (opId !== 'bot') return
    sendRematchRequest()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState?.status, myId])

  // Show Google link prompt once after first match win
  useEffect(() => {
    if (
      matchState?.status === 'match_complete' &&
      matchState.matchWinnerId === myId &&
      !googleLinked &&
      !localStorage.getItem('link_prompt_dismissed')
    ) {
      const t = setTimeout(() => setShowLinkPrompt(true), 0)
      return () => clearTimeout(t)
    }
  }, [matchState?.status, matchState?.matchWinnerId, myId, googleLinked])

  // Capture install prompt — show after first match win
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredInstallRef.current = e as BeforeInstallPromptEvent
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (
      matchState?.status === 'match_complete' &&
      matchState.matchWinnerId === myId &&
      deferredInstallRef.current &&
      !localStorage.getItem('install_prompt_dismissed')
    ) {
      const t = setTimeout(() => setShowInstallPrompt(true), 0)
      return () => clearTimeout(t)
    }
  }, [matchState?.status, matchState?.matchWinnerId, myId])

  const sendRematchRequest = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'rematch_request' }))
    setRematchState('pending')
  }, [])

  // ── Disconnected ─────────────────────────────────────────────────────────

  if (disconnected) {
    return (
      <div style={S.centeredFull}>
        <div style={{ fontSize: '32px' }}>📡</div>
        <p style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n900)' }}>
          Opponent disconnected
        </p>
        <p style={{ fontSize: '13px', color: 'var(--n400)' }}>The game has ended</p>
        <Button variant="secondary" onClick={() => { window.location.href = '/' }}>Back to lobby</Button>
      </div>
    )
  }

  // ── Waiting for opponent ─────────────────────────────────────────────────

  if (!matchState && waitingCount !== null) {
    return (
      <div style={S.centeredFull}>
        <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--n400)', opacity: 0.2, animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite' }} />
          <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--n400)', opacity: 0.8, display: 'block' }} />
        </div>
        <p style={{ fontSize: '17px', fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n900)' }}>
          Waiting for opponent…
        </p>
        <p style={{ fontSize: '13px', color: 'var(--n400)', fontFamily: 'var(--font-mono)' }}>
          {waitingCount}/2 players connected
        </p>
        <style>{`@keyframes ping { 75%,100% { transform: scale(2); opacity: 0; } }`}</style>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (!matchState || !myId) {
    return (
      <div style={{ ...S.centeredFull }}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--n200)', borderTopColor: 'var(--n900)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Forfeit notice (lives only briefly before match_complete arrives) ────

  if (forfeitedBy && matchState.status !== 'match_complete') {
    const youForfeited = forfeitedBy === myId
    return (
      <div style={S.centeredFull}>
        <div style={{ fontSize: '32px' }}>{youForfeited ? '⏱' : '🏆'}</div>
        <p style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n900)' }}>
          {youForfeited ? 'You forfeited the match' : 'Opponent forfeited — you win!'}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--n400)' }}>
          {youForfeited ? "You didn't confirm Play Again in time" : 'They did not confirm Play Again in time'}
        </p>
      </div>
    )
  }

  // ── Match complete — result screen ───────────────────────────────────────

  if (matchState.status === 'match_complete') {
    const won = matchState.matchWinnerId === myId
    const opponentId = matchState.player1Id === myId ? matchState.player2Id : matchState.player1Id
    const isBotMatch = opponentId === 'bot'

    // For bot matches, skip the result screen — rematch fires automatically
    if (isBotMatch) {
      return (
        <div style={S.centeredFull}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--n200)', borderTopColor: 'var(--n900)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--n0)' }}>
        {/* Result header */}
        <div style={{ flexShrink: 0, padding: '36px 20px 24px', textAlign: 'center', borderBottom: '1px solid var(--n100)' }}>
          <div style={{ fontSize: '44px', marginBottom: '10px' }}>{won ? '🏆' : '😔'}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--n900)', marginBottom: '6px' }}>
            {won ? 'Victory!' : 'Defeat'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '14px' }}>
            <div style={{ textAlign: 'center' }}>
              <Avatar name="You" variant="p1" size={38} />
              <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--n900)', marginTop: '6px' }}>
                {matchState.roundWins[myId] ?? 0}
              </div>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--n300)', fontWeight: 500 }}>VS</span>
            <div style={{ textAlign: 'center' }}>
              <Avatar name="?" variant="p2" size={38} />
              <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--n400)', marginTop: '6px' }}>
                {matchState.roundWins[opponentId] ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Round replay */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
          <div style={{ ...S.sectionLabel, marginBottom: '12px' }}>Round recap</div>
          {roundHistory.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--n400)', textAlign: 'center', padding: '20px 0' }}>
              No round data available
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {roundHistory.map(rh => (
                <div key={rh.roundNumber} style={{ border: '1px solid var(--n200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--n0)' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--n50)', borderBottom: '1px solid var(--n100)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ ...S.sectionLabel }}>Round {rh.roundNumber}</span>
                    <Badge variant={rh.winnerId === myId ? 'success' : 'danger'} size="xs">
                      {rh.winnerId === myId ? 'You won' : 'Opponent won'}
                    </Badge>
                  </div>
                  {rh.words.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--n400)', fontStyle: 'italic', padding: '12px 14px' }}>No words played</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '12px 14px' }}>
                      {rh.words.map((entry, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <WordPill
                            word={entry.word}
                            variant={entry.playerId === myId ? 'player1' : 'player2'}
                            size="sm"
                          />
                          {(entry.breakdown.rareTier1 + entry.breakdown.rareTier2 + entry.breakdown.rareTier3) > 0 && (
                            <Badge variant="rare" size="xs">rare</Badge>
                          )}
                          {entry.breakdown.longWord > 0 && (
                            <Badge variant="info" size="xs">long</Badge>
                          )}
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--n400)' }}>
                            +{entry.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Google link prompt */}
        {showLinkPrompt && (
          <div style={{ margin: '0 16px 8px', border: '1px solid var(--accent-warm-light)', borderRadius: 'var(--radius-lg)', background: 'var(--accent-warm-faint)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--n800)', marginBottom: '2px' }}>Save your progress</div>
              <div style={{ fontSize: '12px', color: 'var(--n500)' }}>Link Google to recover your account on any device</div>
            </div>
            <a href="/api/auth/google" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-warm-muted)', whiteSpace: 'nowrap', textDecoration: 'none' }}>Link →</a>
            <button
              onClick={() => { localStorage.setItem('link_prompt_dismissed', '1'); setShowLinkPrompt(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--n400)', fontSize: '16px', padding: '0 2px' }}
              aria-label="Dismiss"
            >×</button>
          </div>
        )}

        {/* Actions */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--n100)', padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!isBotMatch && (rematchState === 'idle' ? (
            <Button variant="primary" size="lg" full onClick={sendRematchRequest}>Rematch</Button>
          ) : (
            <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--n200)', borderRadius: 'var(--radius-md)', background: 'var(--n0)' }}>
              <div style={{ width: '14px', height: '14px', border: '2px solid var(--n300)', borderTopColor: 'var(--n700)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '13px', color: 'var(--n500)' }}>Waiting for opponent…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ))}
          <Button variant={isBotMatch ? 'primary' : 'secondary'} size="lg" full onClick={() => { window.location.href = '/' }}>Back to lobby</Button>
          {showInstallPrompt && (
            <Button
              variant="ghost"
              size="md"
              full
              onClick={async () => {
                const prompt = deferredInstallRef.current
                if (!prompt) return
                await prompt.prompt()
                const { outcome } = await prompt.userChoice
                deferredInstallRef.current = null
                setShowInstallPrompt(false)
                if (outcome === 'dismissed') {
                  localStorage.setItem('install_prompt_dismissed', '1')
                }
              }}
            >
              Add to Home Screen
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ── Round active ─────────────────────────────────────────────────────────

  const round = matchState.currentRound
  if (!round) {
    return (
      <div style={S.centeredFull}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--n200)', borderTopColor: 'var(--n900)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const isMyTurn = round.currentPlayerId === myId
  const opponentId = matchState.player1Id === myId ? matchState.player2Id : matchState.player1Id
  const opponentName = opponentId === 'bot' ? 'Bot' : 'Opponent'
  const gameMode: GameMode = matchState.gameMode ?? 'duel'
  const modeCfg = MODE_CONFIG[gameMode]
  const emptyInv: PowerUpInventory = { extend: 0, secondLife: 0, letterBomb: 0, double: 0, wild: 0, anchor: 0, tax: 0 }
  const myInventory: PowerUpInventory = round.powerUpInventory[myId] ?? emptyInv
  const opponentInventory: PowerUpInventory = round.powerUpInventory[opponentId] ?? emptyInv
  const inDangerZone = dangerZoneEnabled && round.chain.length >= 12
  inDangerZoneRef.current = inDangerZone
  const displayChain = devMode ? TEST_CHAIN_100 : round.chain
  const timerPct = (timeLeft / timerMaxSecs) * 100
  const timerUrgent = timeLeft <= 5 || inDangerZone
  const lastWord = round.chain[round.chain.length - 1]
  const nextSeed = lastWord ? lastWord.slice(-1).toUpperCase() : round.seedLetter.toUpperCase()

  const myRoundScore = round.playerRoundScores[myId] ?? 0
  const oppRoundScore = round.playerRoundScores[opponentId] ?? 0
  const myGameScore = gameScores[myId] ?? 0
  const oppGameScore = gameScores[opponentId] ?? 0

  // Score gap display for Duel mode
  const scoreGap = myRoundScore - oppRoundScore
  const showScoreGap = gameMode === 'duel' && (myRoundScore > 0 || oppRoundScore > 0)

  const oppEffectChips: string[] = round.activeEffects.flatMap(e => {
    if (e.kind === 'letterBomb'  && e.onPlayerId === opponentId) return ['💣 rare']
    if (e.kind === 'anchor'      && e.onPlayerId === opponentId) return [`⚓ ≥${e.minLength}`]
    if (e.kind === 'doubleScore' && e.forPlayerId === opponentId) return [`🎯 ${e.wordsRemaining}W`]
    if (e.kind === 'wildPending' && e.forPlayerId === opponentId) return ['🃏 Wild']
    return []
  })

  const myEffectChips: string[] = round.activeEffects.flatMap(e => {
    // letterBomb constraint on me is surfaced by the full-width effect bar — no duplicate chip
    if (e.kind === 'anchor'      && e.onPlayerId === myId)    return [`⚓ ≥${e.minLength}`]
    if (e.kind === 'doubleScore' && e.forPlayerId === myId)   return [`🎯 ${e.wordsRemaining}W`]
    if (e.kind === 'wildPending' && e.forPlayerId === myId)   return ['🃏 Wild']
    return []
  })

  return (
    <div className="game-shell" style={S.shell}>
    <div id="game-root" style={S.page}>
      {/* Mute toggle */}
      <button
        onClick={() => setMuted(!muted)}
        style={{ position: 'absolute', top: 8, right: 8, zIndex: 70, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px', lineHeight: 1, color: 'var(--n400)', opacity: 0.7 }}
        title={muted ? 'Unmute' : 'Mute'}
        aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {/* Game header */}
      <div style={{ background: 'var(--n50)', borderBottom: '1px solid var(--n200)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={() => { window.location.href = '/' }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--n400)', padding: '4px', lineHeight: 1 }}
          aria-label="Back to lobby"
        >←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n900)' }}>{modeCfg.displayName}</div>
          <div style={{ fontSize: '11px', color: 'var(--n400)', fontFamily: 'var(--font-mono)' }}>Round {round.roundNumber}</div>
        </div>
      </div>

      {/* Timer bar */}
      <div style={{ flexShrink: 0 }}>
        <TimerBar percent={timerPct} danger={timerUrgent} />
      </div>

      {/* Danger Zone strip */}
      {inDangerZone && (
        <div style={{ background: 'var(--danger-zone-bg)', borderBottom: '1px solid var(--danger-zone)', padding: '6px 14px', fontSize: '11px', color: 'var(--danger-zone)', textAlign: 'center', flexShrink: 0, fontWeight: 700, letterSpacing: '0.04em', animation: 'dzPulse 2s ease-in-out infinite' }}>
          ⚠ DANGER ZONE — 2× scoring · 10s timer
        </div>
      )}

      {/* Toast overlay */}
      {activeToast && (
        <div style={{ position: 'fixed', top: 12, left: 0, right: 0, zIndex: 60, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 14px' }}>
          <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 260 }}>
            <GameToast
              key={activeToast.id}
              variant={activeToast.variant}
              subText={activeToast.subText}
              title={activeToast.title}
              onDismiss={() => setActiveToast(null)}
            />
          </div>
        </div>
      )}

      {/* ── Players row ── */}
      <div style={{ background: 'var(--n50)', borderBottom: '1px solid var(--n100)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Me */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, background: isMyTurn ? 'var(--p1-light)' : 'transparent', borderRadius: 'var(--radius-md)', padding: '4px 6px', transition: 'background 0.2s' }}>
          <div style={{ position: 'relative', flexShrink: 0, borderRadius: '50%', boxShadow: isMyTurn ? '0 0 0 2px var(--n0), 0 0 0 4px var(--p1)' : 'none', animation: isMyTurn ? 'turnPulseP1 1.6s ease-in-out infinite' : 'none', transition: 'box-shadow 0.2s' }}>
            <Avatar name="You" variant="p1" size={30} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n800)', margin: '0 0 2px' }}>
              You {isMyTurn && <span style={{ color: 'var(--p1)', fontWeight: 500 }}>· your turn</span>}
            </p>
            <div style={{ margin: '0 0 3px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--p1)' }}>{myRoundScore}</span>
            </div>
            {myEffectChips.length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {myEffectChips.map((chip, i) => (
                  <span key={i} style={{ fontSize: 9, background: 'var(--accent-warm-faint)', color: 'var(--accent-warm-muted)', padding: '1px 5px', borderRadius: '99px', fontWeight: 500 }}>{chip}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 44 }}>
          {/* Central countdown */}
          {matchState.status === 'round_active' && (
            <div style={{
              fontSize: 20,
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              lineHeight: 1,
              color: timeLeft <= 5 ? 'var(--danger)' : timeLeft <= 10 ? '#f59e0b' : 'var(--n500)',
            }}>
              {Math.ceil(timeLeft)}s
            </div>
          )}
          {/* Score gap — Duel mode */}
          {showScoreGap && (
            <div style={{
              fontSize: 14,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              marginTop: 2,
              color: scoreGap > 0 ? 'var(--success)' : scoreGap < 0 ? 'var(--danger)' : 'var(--n400)',
            }}>
              {scoreGap > 0 ? `▲${scoreGap}` : scoreGap < 0 ? `▼${Math.abs(scoreGap)}` : '–'}
            </div>
          )}
        </div>

        {/* Opponent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, justifyContent: 'flex-end', minWidth: 0, background: !isMyTurn ? 'var(--p2-light)' : 'transparent', borderRadius: 'var(--radius-md)', padding: '4px 6px', transition: 'background 0.2s' }}>
          <div style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
            <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n800)', margin: '0 0 2px' }}>
              {!isMyTurn && <span style={{ color: 'var(--p2)', fontWeight: 500 }}>thinking… · </span>}{opponentName}
            </p>
            <div style={{ margin: '0 0 3px', textAlign: 'right' }}>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--p2)' }}>{oppRoundScore}</span>
            </div>
            {oppEffectChips.length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {oppEffectChips.map((chip, i) => (
                  <span key={i} style={{ fontSize: 9, background: 'var(--accent-warm-faint)', color: 'var(--accent-warm-muted)', padding: '1px 5px', borderRadius: '99px', fontWeight: 500 }}>{chip}</span>
                ))}
              </div>
            )}
          </div>
          <div style={{ position: 'relative', flexShrink: 0, borderRadius: '50%', boxShadow: !isMyTurn ? '0 0 0 2px var(--n0), 0 0 0 4px var(--p2)' : 'none', animation: !isMyTurn ? 'turnPulseP2 1.6s ease-in-out infinite' : 'none', transition: 'box-shadow 0.2s' }}>
            <Avatar name="?" variant="p2" size={30} />
          </div>
        </div>
      </div>

      {/* ── Power-ups row ── */}
      <div style={{ background: 'var(--n50, #f9fafb)', borderBottom: '1px solid var(--n100)', padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'nowrap', minWidth: 0 }}>
          {(Object.keys(POWER_UP_LABELS) as PowerUpId[]).map(id => {
            const count = myInventory[id] ?? 0
            const hl = myHighlights[id]
            return (
              <PowerUpTooltip key={id} id={id} description={POWER_DESC[id].own}>
                <span
                  className="pwr-top"
                  data-float={`top-mine-${id}`}
                  style={{ fontSize: 13, opacity: count > 0 ? 1 : 0.15, lineHeight: 1.2, position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 1, padding: '1px 2px', animation: hl === 'earned' ? 'earnGlow 0.8s ease-out' : hl === 'activated' ? 'activateFlash 0.6s ease-out' : 'none' }}>
                  {POWER_UP_LABELS[id].emoji}
                  {count > 0 && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--p1)', fontWeight: 700, lineHeight: 1 }}>{count}</span>}
                </span>
              </PowerUpTooltip>
            )
          })}
        </div>
        <span style={{ fontSize: 9, color: 'var(--n300)', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>PWR</span>
        <div style={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'nowrap', minWidth: 0, justifyContent: 'flex-end' }}>
          {(Object.keys(POWER_UP_LABELS) as PowerUpId[]).map(id => {
            const count = opponentInventory[id] ?? 0
            const hl = oppHighlights[id]
            return (
              <PowerUpTooltip key={id} id={id} description={POWER_DESC[id].opp}>
                <span
                  className="pwr-top"
                  data-float={`opp-${id}`}
                  style={{ fontSize: 13, opacity: count > 0 ? 1 : 0.15, lineHeight: 1.2, position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 1, padding: '1px 2px', animation: hl === 'earned' ? 'earnGlow 0.8s ease-out' : hl === 'activated' ? 'activateFlash 0.6s ease-out' : 'none' }}>
                  {POWER_UP_LABELS[id].emoji}
                  {count > 0 && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--p2)', fontWeight: 700, lineHeight: 1 }}>{count}</span>}
                </span>
              </PowerUpTooltip>
            )
          })}
        </div>
      </div>

      {/* ── Board: the word-chain surface, a distinct panel floating on the page ── */}
      <div style={{
        flex: 1,
        minHeight: 0,
        margin: '8px 10px',
        position: 'relative',
        display: 'flex',
        background: 'var(--n50)',
        border: '1px solid var(--n200)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden',
      }}>

      {/* Word chain + floating reaction FAB */}
      <div style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        display: 'flex',
        overflow: 'hidden',
      }}>
      {/* Scrollable word list — fixed height, holds the full chain */}
      <div ref={chainScrollRef} data-scroll="chain" style={{
        flex: 1,
        minHeight: 0,
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
        scrollBehavior: 'smooth',
      }}>
        {displayChain.length === 0 ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 24, gap: 12 }}>
            {/* Whose move */}
            <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: isMyTurn ? 'var(--p1)' : 'var(--p2)' }}>
              {isMyTurn ? 'Your move' : `${opponentName}’s move`}
            </div>
            {/* Seed letter tile — colored by active player */}
            <div style={{
              width: 52, height: 52, borderRadius: 'var(--radius-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isMyTurn ? 'var(--p1-light)' : 'var(--p2-light)',
              color: isMyTurn ? 'var(--p1)' : 'var(--p2)',
              fontFamily: 'var(--font-display)', fontSize: 32, lineHeight: 1,
              boxShadow: isMyTurn ? '0 0 0 2px var(--p1)' : '0 0 0 2px var(--p2)',
              animation: 'seedPop 0.3s ease-out',
            }}>
              {round.seedLetter.toUpperCase()}
            </div>
            {/* Action prompt */}
            <div style={{ fontSize: 13, color: 'var(--n500)', fontFamily: 'var(--font-body)', textAlign: 'center', maxWidth: 220 }}>
              {isMyTurn
                ? <>Open the chain with a word starting with <strong style={{ color: 'var(--n800)' }}>{round.seedLetter.toUpperCase()}</strong></>
                : <>Waiting for {opponentName} to open the chain…</>}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-end', marginTop: 'auto' }}>
            {displayChain.map((word, i) => {
              const isOwn = matchState.player1Id === myId ? i % 2 === 0 : i % 2 !== 0
              return (
                <WordPill key={i} word={word} variant={isOwn ? 'player1' : 'player2'} size="sm" />
              )
            })}
            {!isMyTurn && (
              <span style={{ fontSize: 12, color: 'var(--n400)', fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--n100)', borderRadius: 'var(--radius-full)', border: '1px dashed var(--n300)' }}>
                {nextSeed.toLowerCase()}<span style={{ animation: 'blink 1s step-end infinite', opacity: 0.5 }}>|</span>
              </span>
            )}
          </div>
        )}
        </div>


        {/* Floating reaction FAB */}
        <div style={{ position: 'absolute', bottom: 10, right: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {reactionsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--n0)', border: '1px solid var(--n200)', borderRadius: 'var(--radius-xl)', padding: '6px 4px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
              {REACTION_OPTIONS.map(r => (
                <button key={r.key} onClick={() => { sendReaction(r.key); setReactionsOpen(false) }}
                  style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: '3px 6px', borderRadius: 'var(--radius-md)', lineHeight: 1 }}>
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setReactionsOpen(o => !o)}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--n0)', border: '1px solid var(--n200)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.15s', transform: reactionsOpen ? 'rotate(45deg)' : 'none' }}>
            {reactionsOpen ? '✕' : '😊'}
          </button>
        </div>

        {/* My power-up strip moved to the input area (see bottom panel) */}

        {/* Floating reactions feed */}
        {reactionFeed.length > 0 && (
          <div style={{ position: 'absolute', top: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
            {reactionFeed.map(r => (
              <div key={r.id} style={{ fontSize: 28, animation: 'reactionFloat 3s ease-out forwards' }}>{r.emoji}</div>
            ))}
          </div>
        )}

        {/* Power floats — rise from power icon columns on earn */}
        {powerFloats.length > 0 && (
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 80 }}>
            {powerFloats.map(f => {
              const color = f.side === 'mine' ? 'var(--p1)' : 'var(--p2)'
              const left = f.x ?? (typeof window !== 'undefined' ? window.innerWidth * (f.side === 'mine' ? 0.25 : 0.75) : 0)
              const top = f.y ?? (typeof window !== 'undefined' ? window.innerHeight - 90 : 0)
              return (
                <div key={f.id} style={{ position: 'fixed', left, top, transform: 'translate(-50%, -50%)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, animation: 'powerFloat 1.1s ease-out forwards' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, border: '2px solid var(--n0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, lineHeight: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
                      {f.emoji}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>+1</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Score / word floats */}
        {floats.length > 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              {floats.map(f => (
                <div key={f.id} style={{ fontSize: 36, fontWeight: 800, fontFamily: f.ok ? 'var(--font-mono)' : 'var(--font-body)', color: f.ok ? (f.byMe ? 'var(--p1)' : 'var(--p2)') : 'var(--danger)', animation: 'scoreFloat 2s ease-out forwards', whiteSpace: 'nowrap', textShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
                  {f.text}
                </div>
              ))}
            </div>
          </div>
        )}

        <style>{`
          html, body { overflow: hidden; max-width: 100vw; overscroll-behavior: none; }
          /* Mobile: full-width column on the default surface */
          .game-shell { background: var(--n50); }
          #game-root { width: 100%; max-width: 640px; }
          /* Desktop: darker backdrop + white column surface for definition (no hard frame) */
          @media (min-width: 700px) {
            .game-shell { background: var(--n150); }
            #game-root { background: var(--n50) !important; }
            .game-bottom { padding-bottom: 32px !important; }
            .game-inputrow { gap: 8px !important; }
            .game-inputrow input { font-size: 16px !important; padding: 13px 16px !important; }
            .game-inputrow button { font-size: 18px !important; padding: 13px 20px !important; }
            .pwr-top { font-size: 16px !important; gap: 2px !important; padding: 1px 3px !important; }
          }
          #game-root * { -webkit-user-select: none; user-select: none; }
          #game-root input { -webkit-user-select: text; user-select: text; }
          /* Chain area scrollbar styling */
          [data-scroll="chain"] { scrollbar-width: thin; scrollbar-color: var(--n300) transparent; }
          [data-scroll="chain"]::-webkit-scrollbar { width: 6px; }
          [data-scroll="chain"]::-webkit-scrollbar-track { background: transparent; }
          [data-scroll="chain"]::-webkit-scrollbar-thumb { background: var(--n300); border-radius: 3px; }
          [data-scroll="chain"]::-webkit-scrollbar-thumb:hover { background: var(--n400); }
          @keyframes blink { 50% { opacity: 0; } }
          @keyframes reactionFloat { 0% { opacity: 0; transform: translateY(20px); } 20% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-40px); } }
          @keyframes scoreFloat { 0% { opacity: 0; transform: translateY(0); } 15% { opacity: 1; transform: translateY(-8px); } 100% { opacity: 0; transform: translateY(-60px); } }
          @keyframes wordShimmer { 0% { filter: brightness(1.6) saturate(1.5); transform: scale(1.05); } 100% { filter: brightness(1) saturate(1); transform: scale(1); } }
          @keyframes earnGlow { 0% { box-shadow: 0 0 0 2px #4caf50; } 60% { box-shadow: 0 0 8px 4px #4caf5088; } 100% { box-shadow: 0 0 0 2px #4caf50; } }
          @keyframes activateFlash { 0% { background: var(--accent-warm-faint); } 50% { background: #ffe09a; } 100% { background: var(--n0); } }
          @keyframes urgentPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(234,179,8,0.8); } 50% { box-shadow: 0 0 0 6px rgba(234,179,8,0); } }
          @keyframes powerFloat { 0% { opacity: 0; transform: translateY(-3px) scale(0.5); } 25% { opacity: 1; transform: translateY(3px) scale(1); } 65% { opacity: 1; } 100% { opacity: 0; transform: translateY(22px) scale(1); } }
          @keyframes dzPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.65; } }
          @keyframes turnPulseP1 { 0%,100% { box-shadow: 0 0 0 2px var(--n0), 0 0 0 4px var(--p1); } 50% { box-shadow: 0 0 0 2px var(--n0), 0 0 0 4px var(--p1), 0 0 0 8px var(--p1-light); } }
          @keyframes turnPulseP2 { 0%,100% { box-shadow: 0 0 0 2px var(--n0), 0 0 0 4px var(--p2); } 50% { box-shadow: 0 0 0 2px var(--n0), 0 0 0 4px var(--p2), 0 0 0 8px var(--p2-light); } }
          @keyframes seedPop { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        `}</style>
      </div>
      </div>

      {/* ── Bottom panel ── */}
      <div className="game-bottom" style={{ background: 'var(--n50)', borderTop: '1px solid var(--n200)', padding: '10px 14px 20px', flexShrink: 0 }}>

        {/* My power-ups — centered, spaced, attached to the input area (duel mode) */}
        {gameMode === 'duel' && (
          <div style={{ display: 'flex', gap: 22, alignItems: 'center', justifyContent: 'center', padding: '2px 0 10px', marginBottom: 10, borderBottom: '1px solid var(--n100)' }}>
            {(Object.keys(POWER_UP_LABELS) as PowerUpId[]).map(id => {
              const count = myInventory[id] ?? 0
              const earned = count > 0
              // secondLife and extend can be used anytime (affect your own timer); all others require your turn
              const turnLocked = !isMyTurn && id !== 'secondLife' && id !== 'extend'
              const hl = myHighlights[id]
              return (
                <PowerUpTooltip key={id} id={id} description={POWER_DESC[id].own} onActivate={earned && !turnLocked ? () => activatePowerUp(id) : () => {}} disabled={!earned || turnLocked}>
                  <span
                    style={{ position: 'relative', display: 'inline-flex', padding: '2px 3px', cursor: earned && !turnLocked ? 'pointer' : 'default', opacity: earned ? (turnLocked ? 0.5 : 1) : 0.2, filter: earned ? 'none' : 'grayscale(1)', flexShrink: 0, borderRadius: 6, animation: hl === 'earned' ? 'earnGlow 0.8s ease-out' : hl === 'activated' ? 'activateFlash 0.6s ease-out' : (id === 'secondLife' && isMyTurn && timeLeft <= 8 && count > 0) ? 'urgentPulse 0.8s ease-in-out infinite' : 'none' }}>
                    <span style={{ fontSize: 24, lineHeight: 1 }}>{POWER_UP_LABELS[id].emoji}</span>
                    {earned && (
                      <span style={{ position: 'absolute', top: -2, right: -5, fontSize: 8, fontFamily: 'var(--font-mono)', background: 'var(--p1)', color: 'var(--n0)', borderRadius: '99px', padding: '1px 3px', fontWeight: 700, lineHeight: 1 }}>×{count}</span>
                    )}
                  </span>
                </PowerUpTooltip>
              )
            })}
          </div>
        )}

        {/* Opponent effect bar — full-width strip styled like the Danger Zone bar */}
        {isMyTurn && round.activeEffects.some(e => (e.kind === 'letterBomb' && e.onPlayerId === myId) || (e.kind === 'anchor' && e.onPlayerId === myId)) && (
          <div style={{ margin: '0 -14px 10px', background: 'var(--accent-warm-subtle)', borderTop: '1px solid var(--accent-warm-light)', borderBottom: '1px solid var(--accent-warm-light)', padding: '7px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--accent-warm-muted)', textAlign: 'center', animation: 'dzPulse 2s ease-in-out infinite' }}>
            {round.activeEffects.find(e => e.kind === 'letterBomb' && e.onPlayerId === myId) && (
              <span style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 6px' }}>
                <span>💣 NEXT WORD MUST CONTAIN ANY RARE LETTER —</span>
                <span style={{ whiteSpace: 'nowrap' }}>Q X Z J V K W F H Y B</span>
              </span>
            )}
            {round.activeEffects.find(e => e.kind === 'anchor' && e.onPlayerId === myId) && '⚓ NEXT WORD MUST BE 6+ LETTERS'}
          </div>
        )}

        {/* Turn label + word count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          {isMyTurn ? (
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-heading)', color: inDangerZone ? 'var(--danger-zone)' : 'var(--p1)' }}>
              Word starting with <strong>{nextSeed}</strong>
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--n400)', fontFamily: 'var(--font-body)' }}>Waiting for opponent…</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--n400)', fontFamily: 'var(--font-mono)' }}>{displayChain.length} words</span>
        </div>

        {/* Input row */}
        <div className="game-inputrow" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            value={wordInput}
            onChange={e => setWordInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { submitWord(); return }
              if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key.length === 1 || e.key === 'Backspace')) play('tap')
            }}
            onBlur={() => { if (isMobile && isMyTurn && !submitting) setTimeout(() => inputRef.current?.focus(), 0) }}
            disabled={!isMyTurn || submitting}
            placeholder={isMyTurn ? (round.chain.length === 0 ? `Start with ${round.seedLetter.toUpperCase()}…` : `${nextSeed}…`) : 'Waiting…'}
            autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
            inputMode={isMobile ? 'none' : 'text'} enterKeyHint="send"
            style={{ ...S.input, fontSize: 13, padding: '7px 10px', opacity: !isMyTurn || submitting ? 0.45 : 1, cursor: !isMyTurn || submitting ? 'not-allowed' : 'text' }}
          />
          <Button variant="primary" size="sm" onClick={submitWord} disabled={!isMyTurn || submitting || !wordInput.trim()}>
            {submitting ? '…' : '→'}
          </Button>
          {isMobile && (
            <button
              onClick={() => setKeyboardVisible(v => !v)}
              disabled={!isMyTurn}
              style={{ background: keyboardVisible && isMyTurn ? 'var(--n900)' : 'var(--n100)', border: '1px solid var(--n200)', borderRadius: 'var(--radius-md)', padding: '6px 8px', fontSize: 15, lineHeight: 1, cursor: isMyTurn ? 'pointer' : 'default', opacity: isMyTurn ? 1 : 0.4, color: keyboardVisible && isMyTurn ? 'var(--n0)' : 'var(--n600)', flexShrink: 0 }}
              aria-label={keyboardVisible ? 'Hide keyboard' : 'Show keyboard'}
            >⌨</button>
          )}
        </div>
      </div>

      {/* Game keyboard — mobile only, shown on my turn when visible */}
      {isMobile && isMyTurn && keyboardVisible && (
        <GameKeyboard onKey={handleGameKey} disabled={submitting} />
      )}

      {/* ── Round complete modal ── */}
      {matchState.status === 'round_complete' && (() => {
        const ctx = matchState.roundEndContext
        const iWonRound = ctx?.winnerId === myId
        const iConfirmed = ctx?.nextRoundConfirmations.includes(myId) ?? false
        const opponentConfirmed = ctx?.nextRoundConfirmations.includes(opponentId) ?? false
        const myRoundWins = matchState.roundWins[myId] ?? 0
        const oppRoundWins = matchState.roundWins[opponentId] ?? 0
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}>
            <div style={{ width: '100%', maxWidth: 360, background: 'var(--n0)', border: '1px solid var(--n200)', borderRadius: 'var(--radius-xl)', padding: '28px 24px', textAlign: 'center', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>{iWonRound ? '🎉' : '😤'}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--n900)', marginBottom: '4px' }}>
                <span style={{ color: 'var(--p1)' }}>{myRoundWins}</span>
                <span style={{ color: 'var(--n300)', margin: '0 8px' }}>–</span>
                <span style={{ color: 'var(--p2)' }}>{oppRoundWins}</span>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--n600)', marginBottom: '20px' }}>
                {iWonRound ? 'You won the round!' : 'Opponent won the round'}
              </p>
              <Button variant="primary" size="lg" full onClick={sendNextRoundRequest} disabled={iConfirmed}>
                {iConfirmed ? 'Ready ✓' : 'Play Again'}
              </Button>
              <div style={{ marginTop: '8px' }}>
                <Button variant="secondary" size="lg" full onClick={() => { window.location.href = '/' }}>Back to Lobby</Button>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--n500)' }}>
                {opponentConfirmed ? 'Opponent is ready' : 'Waiting on opponent…'}
                <span style={{ marginLeft: '8px', fontFamily: 'var(--font-mono)', color: nextRoundTimeLeft <= 5 ? 'var(--danger)' : 'var(--n400)' }}>
                  {Math.ceil(nextRoundTimeLeft)}s
                </span>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
    </div>
  )
}

export default function GamePage() {
  return (
    <Suspense>
      <GameContent />
    </Suspense>
  )
}
