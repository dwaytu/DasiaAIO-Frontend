import {
  EMERGENCY_AUDIO_BEACON_STORAGE_KEY,
  isEmergencyAudioBeaconEnabled,
  playTacticalSosChime,
  setEmergencyAudioBeaconEnabled,
} from '../tacticalAudio'

describe('tactical audio', () => {
  afterEach(() => {
    localStorage.clear()
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined })
  })

  it('defaults the local emergency beacon preference to enabled and persists an explicit choice', () => {
    expect(isEmergencyAudioBeaconEnabled()).toBe(true)
    setEmergencyAudioBeaconEnabled(false)
    expect(localStorage.getItem(EMERGENCY_AUDIO_BEACON_STORAGE_KEY)).toBe('false')
    expect(isEmergencyAudioBeaconEnabled()).toBe(false)
  })

  it('fails silently when browser audio is unavailable', async () => {
    const playback = playTacticalSosChime()
    await expect(playback.completed).resolves.toBe(false)
    expect(() => playback.stop()).not.toThrow()
  })
})
