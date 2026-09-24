import { useEffect, useRef } from 'react'

const NUM = 68

export default function NeuralBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let W = window.innerWidth, H = window.innerHeight
    canvas.width = W; canvas.height = H

    const mouse = { x: W / 2, y: H / 2 }
    const onMouse = e => { mouse.x = e.clientX; mouse.y = e.clientY }
    window.addEventListener('mousemove', onMouse)

    /* ── Particles ── */
    const pts = Array.from({ length: NUM }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 2.2 + 0.9,
      phase: Math.random() * Math.PI * 2,
      pSpeed: 0.012 + Math.random() * 0.022,
    }))
    // Mouse-attraction node
    pts.push({ x: mouse.x, y: mouse.y, vx: 0, vy: 0, r: 4.5, isMouse: true, phase: 0, pSpeed: 0.04 })

    /* ── Get hue at any (x,y,t) — perfectly matches the background blobs ── */
    const getHue = (x, y, t) => {
      // Four slowly-orbiting color anchors
      const anchors = [
        { cx: W * (0.18 + 0.14 * Math.sin(t * 0.0028)),        cy: H * (0.25 + 0.18 * Math.cos(t * 0.0033)),        h: 240 + 55 * Math.sin(t * 0.0041) },  // navy ↔ purple
        { cx: W * (0.78 + 0.14 * Math.cos(t * 0.0031)),        cy: H * (0.65 + 0.18 * Math.sin(t * 0.0025)),        h: 290 + 55 * Math.sin(t * 0.0037 + 1.3) },  // purple ↔ magenta
        { cx: W * (0.50 + 0.20 * Math.sin(t * 0.0022 + 1.0)),  cy: H * (0.08 + 0.12 * Math.cos(t * 0.0038 + 2.1)),  h: 185 + 55 * Math.sin(t * 0.0029 + 2.4) },  // teal ↔ cyan
        { cx: W * (0.08 + 0.10 * Math.cos(t * 0.0035 + 2.5)), cy: H * (0.82 + 0.10 * Math.sin(t * 0.0042 + 0.7)),  h: 320 + 40 * Math.sin(t * 0.0051 + 3.0) },  // pink ↔ violet
        { cx: W * (0.88 + 0.10 * Math.sin(t * 0.0027 + 1.8)), cy: H * (0.15 + 0.12 * Math.cos(t * 0.0044 + 1.2)),  h: 160 + 40 * Math.sin(t * 0.0033 + 1.8) },  // green-teal
      ]

      // Inverse-distance weighted blend of all anchor hues
      let sumW = 0, sumH = 0
      anchors.forEach(a => {
        const dx = x - a.cx, dy = y - a.cy
        const dist2 = dx * dx + dy * dy + 10000
        const w = 1 / dist2
        sumW += w; sumH += w * a.h
      })
      return sumH / sumW
    }

    let t = 0, id

    const draw = () => {
      t++

      /* ── 1. BACKGROUND: animated multicolor blobs ── */
      // Base fill — pure dark
      ctx.globalAlpha = 1
      ctx.fillStyle = 'hsl(240,40%,2%)'
      ctx.fillRect(0, 0, W, H)

      // 5 slow-moving radial gradient blobs
      const blobs = [
        { x: W * (0.18 + 0.14 * Math.sin(t * 0.0028)),       y: H * (0.25 + 0.18 * Math.cos(t * 0.0033)),       r: W * 0.40, h: 240 + 55 * Math.sin(t * 0.0041),        a: 0.20 },
        { x: W * (0.78 + 0.14 * Math.cos(t * 0.0031)),       y: H * (0.65 + 0.18 * Math.sin(t * 0.0025)),       r: W * 0.38, h: 290 + 55 * Math.sin(t * 0.0037 + 1.3),  a: 0.18 },
        { x: W * (0.50 + 0.20 * Math.sin(t * 0.0022 + 1.0)), y: H * (0.08 + 0.12 * Math.cos(t * 0.0038 + 2.1)), r: W * 0.32, h: 185 + 55 * Math.sin(t * 0.0029 + 2.4),  a: 0.16 },
        { x: W * (0.08 + 0.10 * Math.cos(t * 0.0035 + 2.5)), y: H * (0.82 + 0.10 * Math.sin(t * 0.0042 + 0.7)), r: W * 0.28, h: 320 + 40 * Math.sin(t * 0.0051 + 3.0),  a: 0.14 },
        { x: W * (0.88 + 0.10 * Math.sin(t * 0.0027 + 1.8)), y: H * (0.15 + 0.12 * Math.cos(t * 0.0044 + 1.2)), r: W * 0.26, h: 160 + 40 * Math.sin(t * 0.0033 + 1.8),  a: 0.13 },
      ]

      blobs.forEach(b => {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
        g.addColorStop(0, `hsla(${b.h},85%,14%,${b.a * 2.2})`)
        g.addColorStop(0.45, `hsla(${b.h},75%,8%,${b.a})`)
        g.addColorStop(1, `hsla(${b.h},60%,3%,0)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
      })

      /* ── 2. NEURAL NETWORK — colors sampled from background ── */

      // Update mouse node
      const mp = pts[pts.length - 1]
      mp.x += (mouse.x - mp.x) * 0.09
      mp.y += (mouse.y - mp.y) * 0.09

      // Draw connections first (below nodes)
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          const MAX = (pts[i].isMouse || pts[j].isMouse) ? 195 : 128

          if (d < MAX) {
            const alpha = (1 - d / MAX) * 0.55
            const hi = getHue(pts[i].x, pts[i].y, t)
            const hj = getHue(pts[j].x, pts[j].y, t)

            const grad = ctx.createLinearGradient(pts[i].x, pts[i].y, pts[j].x, pts[j].y)
            grad.addColorStop(0, `hsla(${hi},100%,70%,${alpha})`)
            grad.addColorStop(0.5, `hsla(${(hi + hj) / 2},100%,65%,${alpha * 0.7})`)
            grad.addColorStop(1, `hsla(${hj},100%,70%,${alpha * 0.5})`)

            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = grad
            ctx.lineWidth = pts[i].isMouse || pts[j].isMouse ? 1.4 : 0.7
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      pts.forEach(p => {
        if (!p.isMouse) {
          p.x += p.vx; p.y += p.vy
          if (p.x < 0 || p.x > W) p.vx *= -1
          if (p.y < 0 || p.y > H) p.vy *= -1
        }

        // Hue perfectly matches local background color
        const h = getHue(p.x, p.y, t)
        const pulse = 0.72 + 0.28 * Math.sin(t * p.pSpeed * 55 + p.phase)
        const r = p.r * pulse

        // Wide glow halo
        const glowR = r * (p.isMouse ? 7 : 5.5)
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR)
        glow.addColorStop(0, `hsla(${h},100%,72%,${p.isMouse ? 0.50 : 0.22})`)
        glow.addColorStop(0.5, `hsla(${h},100%,60%,${p.isMouse ? 0.20 : 0.08})`)
        glow.addColorStop(1, `hsla(${h},100%,50%,0)`)
        ctx.beginPath()
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // Core bright dot
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${h},100%,82%,${0.65 + 0.35 * pulse})`
        ctx.shadowColor = `hsl(${h},100%,70%)`
        ctx.shadowBlur = p.isMouse ? 22 : 10
        ctx.fill()
        ctx.shadowBlur = 0
      })

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
      zIndex: 0, pointerEvents: 'none',
    }} />
  )
}
