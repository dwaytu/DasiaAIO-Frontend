export const EMERGENCY_AUDIO_BEACON_STORAGE_KEY = 'sentinel_audio_beacon_enabled'

type TacticalAudioContext = AudioContext & { state?: AudioContextState }

export type TacticalChimePlayback = {
  completed: Promise<boolean>
  stop: () => void
}

function getAudioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  return window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

export function isEmergencyAudioBeaconEnabled(): boolean {
  try {
    return window.localStorage.getItem(EMERGENCY_AUDIO_BEACON_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

export function setEmergencyAudioBeaconEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(EMERGENCY_AUDIO_BEACON_STORAGE_KEY, String(enabled))
  } catch {
    // This preference is optional in privacy-restricted browser contexts.
  }
}

export function playTacticalSosChime(): TacticalChimePlayback {
  let context: TacticalAudioContext | null = null
  let closeTimer: number | undefined
  const oscillators: OscillatorNode[] = []
  let stopped = false

  const stop = () => {
    if (stopped) return
    stopped = true
    if (closeTimer !== undefined) window.clearTimeout(closeTimer)
    oscillators.forEach((oscillator) => {
      try { oscillator.stop() } catch { /* Scheduled tones may already have ended. */ }
    })
    if (context) void Promise.resolve(context.close()).catch(() => undefined)
  }

  const completed = (async () => {
    try {
      const AudioContextCtor = getAudioContextConstructor()
      if (!AudioContextCtor) return false
      context = new AudioContextCtor() as TacticalAudioContext
      if (context.state === 'suspended') await context.resume()

      ;[520, 660].forEach((frequency, index) => {
        const oscillator = context!.createOscillator()
        const gain = context!.createGain()
        const startsAt = context!.currentTime + index * 0.08
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0.04, startsAt)
        gain.gain.exponentialRampToValueAtTime(0.001, startsAt + 0.3)
        oscillator.connect(gain).connect(context!.destination)
        oscillator.start(startsAt)
        oscillator.stop(startsAt + 0.32)
        oscillators.push(oscillator)
      })
      closeTimer = window.setTimeout(stop, 500)
      return true
    } catch {
      stop()
      return false
    }
  })()

  return { completed, stop }
}
