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
}

const ParticleBackground: FC<ParticleBackgroundProps> = ({
  className = '',
  particleCount = 80,
  color = '56, 189, 248',
  connectDistance = 140,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        radius: Math.random() * 1.4 + 0.6,
        opacity: Math.random() * 0.3 + 0.12,
        pulseSpeed: Math.random() * 0.008 + 0.003,
        pulsePhase: Math.random() * Math.PI * 2,
      }))
    }

    if (prefersReducedMotion) {
      resize()
      const particles = particlesRef.current
      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${color}, ${p.opacity})`
        ctx.fill()
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < connectDistance) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(${color}, ${(1 - dist / connectDistance) * 0.18})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      return
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const particles = particlesRef.current
      const now = performance.now() / 1000

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        const pulse = Math.sin(now * p.pulseSpeed * 60 + p.pulsePhase) * 0.08
        const finalOpacity = Math.min(0.5, Math.max(0.05, p.opacity + pulse))

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${color}, ${finalOpacity})`
        ctx.fill()
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < connectDistance) {
            const lineOpacity = (1 - dist / connectDistance) * 0.18
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(${color}, ${lineOpacity})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(draw)
    }

    resize()
    draw()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      ro.disconnect()
    }
  }, [particleCount, color, connectDistance])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ display: 'block' }}
    />
  )
}

export default ParticleBackground
