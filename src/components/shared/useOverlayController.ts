import { RefObject, useEffect, useRef, useState } from 'react'

export function useOverlayController<T extends string>(extraRefs: Array<RefObject<HTMLElement | null>> = []) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [activeOverlay, setActiveOverlay] = useState<T | null>(null)

  const closeOverlay = () => setActiveOverlay(null)

  const openOverlay = (overlay: T) => {
    setActiveOverlay(overlay)
  }

  const toggleOverlay = (overlay: T) => {
    setActiveOverlay((current) => (current === overlay ? null : overlay))
  }

  useEffect(() => {
    if (!activeOverlay) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      const isInsideRoot = rootRef.current?.contains(target) ?? false
      const isInsideExtra = extraRefs.some((ref) => ref.current?.contains(target))

      if (!isInsideRoot && !isInsideExtra) {
        closeOverlay()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeOverlay()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [activeOverlay, extraRefs])

  return {
    rootRef,
    activeOverlay,
    closeOverlay,
    openOverlay,
    toggleOverlay,
    isOverlayOpen: (overlay: T) => activeOverlay === overlay,
  }
}