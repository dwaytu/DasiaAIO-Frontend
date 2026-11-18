import {
  getGuardGuidePreference,
  guardGuideStorageKey,
  saveGuardGuidePreference,
} from '../guardGuide'

describe('guard guide local preference', () => {
  const userId = 'guard-42'

  beforeEach(() => {
    window.localStorage.clear()
  })

  it('keeps a dismissal local to the guard account on this device', () => {
    expect(getGuardGuidePreference(userId)).toBeNull()
    saveGuardGuidePreference(userId, 'dismissed')
    expect(getGuardGuidePreference(userId)).toBe('dismissed')
    expect(getGuardGuidePreference('guard-43')).toBeNull()
  })

  it('records completion without any backend state', () => {
    saveGuardGuidePreference(userId, 'completed')
    expect(window.localStorage.getItem(guardGuideStorageKey(userId))).toBe('completed')
    expect(getGuardGuidePreference(userId)).toBe('completed')
  })

  it('ignores malformed stored values so the optional guide can be shown safely', () => {
    window.localStorage.setItem(guardGuideStorageKey(userId), 'unexpected')
    expect(getGuardGuidePreference(userId)).toBeNull()
  })
})
