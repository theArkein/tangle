'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type SoundName = 'word_valid' | 'word_invalid' | 'turn_start' | 'opp_turn' | 'danger_zone' |
  'power_earned' | 'power_used_me' | 'power_used_opp' | 'round_win' | 'match_win' |
  'time_warn' | 'reaction' | 'tap'

let _engine: Record<SoundName, () => void> | null = null

function getSoundEngine(): Record<SoundName, () => void> {
  if (_engine) return _engine
  let ctx: AudioContext | null = null

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }

  function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.22, t0 = 0) {
    const c = ac(), osc = c.createOscillator(), g = c.createGain()
    osc.connect(g); g.connect(c.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, c.currentTime + t0)
    g.gain.setValueAtTime(0, c.currentTime + t0)
    g.gain.linearRampToValueAtTime(vol, c.currentTime + t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t0 + dur)
    osc.start(c.currentTime + t0); osc.stop(c.currentTime + t0 + dur + 0.05)
  }

  function noise(dur: number, vol = 0.08, t0 = 0, band = 800) {
    const c = ac()
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = c.createBufferSource(); src.buffer = buf
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = band
    const g = c.createGain()
    src.connect(f); f.connect(g); g.connect(c.destination)
    g.gain.setValueAtTime(vol, c.currentTime + t0)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t0 + dur)
    src.start(c.currentTime + t0); src.stop(c.currentTime + t0 + dur + 0.05)
  }

  _engine = {
    word_valid()    { tone(523,.12,'sine',.22,0); tone(659,.12,'sine',.22,.08); tone(784,.24,'sine',.28,.16) },
    word_invalid()  { tone(220,.08,'sawtooth',.12,0); tone(185,.08,'sawtooth',.12,.09); tone(155,.18,'sawtooth',.10,.18) },
    turn_start()    { tone(880,.16,'sine',.16,0); tone(1108,.14,'sine',.13,.10) },
    opp_turn()      { tone(440,.22,'sine',.08,0) },
    danger_zone()   { tone(110,.28,'triangle',.28,0); tone(110,.28,'triangle',.28,.34); tone(165,.38,'triangle',.22,.68) },
    power_earned()  { [523,659,784,1047].forEach((f,i) => tone(f,.12,'sine',.18,i*.07)) },
    power_used_me() { tone(300,.08,'square',.10,0); tone(600,.12,'sawtooth',.12,.08); tone(900,.26,'sine',.18,.18) },
    power_used_opp(){ tone(600,.12,'sawtooth',.12,0); tone(300,.18,'sawtooth',.12,.10); noise(.18,.07,.14,600) },
    round_win()     { tone(392,.12,'sine',.22,0); tone(440,.12,'sine',.22,.11); tone(523,.32,'sine',.28,.22) },
    match_win()     { [523,659,784,1047].forEach((f,i)=>tone(f,.10,'sine',.22,i*.09)); tone(784,.20,'sine',.18,.72) },
    time_warn()     { [0,.16,.32].forEach(t0=>tone(880,.06,'square',.18,t0)) },
    reaction()      { tone(800,.07,'sine',.14,0); tone(1200,.10,'sine',.10,.05) },
    tap()           { noise(.02,.20,0,3000); noise(.05,.12,.01,280) },
  }
  return _engine
}

export function useSoundEngine() {
  const [muted, setMutedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sfx_muted') === '1'
  })
  const mutedRef = useRef(muted)

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  const setMuted = useCallback((v: boolean) => {
    setMutedState(v)
    mutedRef.current = v
    if (typeof window !== 'undefined') localStorage.setItem('sfx_muted', v ? '1' : '0')
  }, [])

  const play = useCallback((name: SoundName) => {
    if (mutedRef.current || typeof window === 'undefined') return
    try { getSoundEngine()[name]() } catch {}
  }, [])

  return { play, muted, setMuted }
}
