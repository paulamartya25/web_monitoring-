import { useEffect, useRef } from 'react'

const NUM   = 55
const DIST  = 140
const AMBER = 'rgba(245,158,11,'

export default function NeuralBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let W = window.innerWidth
    let H = window.innerHeight
    canvas.width = W
    canvas.height = H

    const mouse = { x: W / 2, y: H / 2 }
    const onMouse = e => { mouse.x = e.clientX; mouse.y = e.clientY }
    window.addEventListener('mousemove', onMouse)

    const pts = Array.from({ length: NUM }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 1.8 + 0.8,
    }))

    // Mouse attraction particle
    pts.push({ x: mouse.x, y: mouse.y, vx: 0, vy: 0, r: 3, isMouse: true })

    let id
    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      // Update mouse particle
      const mp = pts[pts.length - 1]
      mp.x += (mouse.x - mp.x) * 0.08
      mp.y += (mouse.y - mp.y) * 0.08

      pts.forEach(p => {
        if (!p.isMouse) {
          p.x += p.vx; p.y += p.vy
          if (p.x < 0 || p.x > W) p.vx *= -1
          if (p.y < 0 || p.y > H) p.vy *= -1
        }

        // Draw node
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.isMouse ? AMBER + '0.9)' : AMBER + '0.55)'
        ctx.shadowColor = '#f59e0b'
        ctx.shadowBlur = p.isMouse ? 12 : 4
        ctx.fill()
        ctx.shadowBlur = 0
      })

      // Draw connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < DIST) {
            const a = (1 - d / DIST) * 0.28
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = AMBER + a + ')'
            ctx.lineWidth = 0.6
            ctx.stroke()
          }
        }
      }

      id = requestAnimationFrame(draw)
    }
    draw()

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W; canvas.height = H
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      zIndex: 0, pointerEvents: 'none', opacity: 0.45,
    }} />
  )
}
