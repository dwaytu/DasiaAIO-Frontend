import { useEffect, useRef, FC } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  pulseSpeed: number
  pulsePhase: number
}

interface ParticleBackgroundProps {
  className?: string
  particleCount?: number
  color?: string
  connectDistance?: number
  mouseRadius?: number
}

const ParticleBackground: FC<ParticleBackgroundProps> = ({
  className = '',
  particleCount = 80,
  color = '0, 200, 230',
  connectDistance = 120,
  mouseRadius = 150,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const animFrameRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      initParticles()
    }

    const initParticles = () => {
      particlesRef.current = Array.from({ length: particleCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.3,
        pulseSpeed: Math.random() * 0.02 + 0.005,
        pulsePhase: Math.random() * Math.PI * 2,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const particles = particlesRef.current
      const mouse = mouseRef.current
      const now = performance.now() / 1000

      // Update and draw particles
      for (const p of particles) {
        // Mouse repulsion
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < mouseRadius && dist > 0) {
          const force = (mouseRadius - dist) / mouseRadius
          p.vx += (dx / dist) * force * 0.3
          p.vy += (dy / dist) * force * 0.3
        }

        // Dampen velocity
        p.vx *= 0.98
        p.vy *= 0.98

        // Clamp velocity
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > 1.5) { p.vx = (p.vx / speed) * 1.5; p.vy = (p.vy / speed) * 1.5 }

        p.x += p.vx
        p.y += p.vy

        // Wrap edges
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        // Pulse opacity
        const pulse = Math.sin(now * p.pulseSpeed * 60 + p.pulsePhase) * 0.15
        const finalOpacity = Math.min(1, Math.max(0.1, p.opacity + pulse))

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${color}, ${finalOpacity})`
        ctx.fill()
      }

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < connectDistance) {
            const lineOpacity = (1 - dist / connectDistance) * 0.35
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(${color}, ${lineOpacity})`
            ctx.lineWidth = 0.8
            ctx.stroke()
          }
        }
      }

      // Draw mouse glow lines
      for (const p of particles) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < mouseRadius * 0.8) {
          const lineOpacity = (1 - dist / (mouseRadius * 0.8)) * 0.6
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(mouse.x, mouse.y)
          ctx.strokeStyle = `rgba(${color}, ${lineOpacity})`
          ctx.lineWidth = 0.6
          ctx.stroke()
        }
      }

      animFrameRef.current = requestAnimationFrame(draw)
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 }
    }

    resize()
    draw()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)
    // Also listen on window so mouse outside canvas still triggers
    window.addEventListener('mousemove', onMouseMove)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [particleCount, color, connectDistance, mouseRadius])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ display: 'block' }}
    />
  )
}

export default ParticleBackground
