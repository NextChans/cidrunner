import { HOP_SECONDS, type SimResult } from '@/graph/simulate'

/**
 * Playback audio (ADR 0058). The simulation's timing data (`arrivals`, hop
 * stagger) is turned into a one-pass sound schedule synchronized with the
 * particle animation: a short tick per hop (pitch rising along the chain), a
 * two-note "data saved" chime per successful flow, a low buzz per blocked one.
 *
 * Sounds play ONCE per Start (the particles loop; looping audio would be
 * torture). Everything is synthesized with the Web Audio API — zero audio
 * assets, static hosting untouched. The AudioContext is created lazily inside
 * the Start-click gesture, which is exactly what autoplay policies require.
 */

export interface SoundEvent {
  /** Seconds from schedule start. */
  t: number
  kind: 'tick' | 'chime' | 'buzz'
  /** Hop index — drives the rising pitch of ticks. */
  step: number
}

/** Pure, testable plan: sim result → deduplicated, time-ordered sound events. */
export function soundPlan(sim: SimResult): SoundEvent[] {
  const events = new Map<string, SoundEvent>()
  const add = (e: SoundEvent) => {
    const key = `${e.kind}:${Math.round(e.t * 100)}:${e.kind === 'tick' ? e.step : ''}`
    if (!events.has(key)) events.set(key, e)
  }

  for (const flow of sim.flows) {
    flow.pathNodeIds.forEach((nodeId, i) => {
      if (i === 0) return // the entry doesn't tick — sound starts with motion
      add({ t: sim.arrivals[nodeId] ?? i * HOP_SECONDS, kind: 'tick', step: i })
    })
    const last = flow.pathNodeIds[flow.pathNodeIds.length - 1]
    if (flow.ok && last !== undefined) {
      add({ t: (sim.arrivals[last] ?? 0) + 0.12, kind: 'chime', step: flow.pathNodeIds.length })
    }
    if (!flow.ok && flow.blockedNodeId) {
      add({ t: (sim.arrivals[flow.blockedNodeId] ?? 0) + 0.2, kind: 'buzz', step: 0 })
    }
  }

  return [...events.values()].sort((a, b) => a.t - b.t).slice(0, 64)
}

// ---- Web Audio player (browser only) ---------------------------------------

let audioCtx: AudioContext | null = null
let master: GainNode | null = null
let live: OscillatorNode[] = []

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (!audioCtx) {
    audioCtx = new AudioContext()
    master = audioCtx.createGain()
    master.gain.value = 0.12 // quiet by design — informative, not startling
    master.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  return audioCtx
}

function tone(
  ctx: AudioContext,
  at: number,
  freq: number,
  dur: number,
  type: OscillatorType,
  peak: number,
) {
  if (!master) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(gain)
  gain.connect(master)
  osc.start(at)
  osc.stop(at + dur + 0.02)
  live.push(osc)
}

/** Schedules one audio pass for a simulation run (cancels any previous pass). */
export function playSimSounds(sim: SimResult): void {
  const ctx = ensureContext()
  if (!ctx) return
  stopSimSounds()
  const t0 = ctx.currentTime + 0.05
  for (const e of soundPlan(sim)) {
    const at = t0 + e.t
    if (e.kind === 'tick') {
      // Rising whole-tone steps as the request advances hop by hop.
      tone(ctx, at, 440 * Math.pow(1.1225, e.step), 0.07, 'sine', 0.5)
    } else if (e.kind === 'chime') {
      // "Data saved" — a small major-third flourish.
      tone(ctx, at, 880, 0.22, 'sine', 0.6)
      tone(ctx, at + 0.09, 1108.7, 0.28, 'sine', 0.5)
    } else {
      // Blocked — a low, short growl.
      tone(ctx, at, 98, 0.3, 'sawtooth', 0.55)
    }
  }
}

/** Silences any pass still scheduled/playing. */
export function stopSimSounds(): void {
  for (const osc of live) {
    try {
      osc.stop()
    } catch {
      // already stopped — fine
    }
  }
  live = []
}
