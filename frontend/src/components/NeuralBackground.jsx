import { useEffect, useRef } from 'react'

const NUM = 75

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

    /* ── Particles ─────────────────────────────────────────── */
    const pts = Array.from({ length: NUM }, () => ({
      x:      Math.random() * W,
      y:      Math.random() * H,
      vx:     (Math.random() - 0.5) * 0.55,
      vy:     (Math.random() - 0.5) * 0.55,
      r:      Math.random() * 2.4 + 1.0,
      phase:  Math.random() * Math.PI * 2,
      pSpeed: 0.014 + Math.random() * 0.024,
      baseHue: Math.random() * 360,           // each particle has base color
    }))
    // Mouse node
    pts.push({ x: mouse.x, y: mouse.y, vx:0, vy:0, r:5, isMouse:true, phase:0, pSpeed:0.04, baseHue:180 })

    /* ── 8 orbiting color anchors spread across full hue wheel ── */
    const ANCHORS = [
      { hueBase: 0,   px: 0.15, py: 0.25, speedX: 0.0031, speedY: 0.0038, phaseX: 0.0,  phaseY: 0.5  },  // red
      { hueBase: 45,  px: 0.82, py: 0.15, speedX: 0.0027, speedY: 0.0042, phaseX: 1.2,  phaseY: 0.3  },  // orange
      { hueBase: 90,  px: 0.65, py: 0.75, speedX: 0.0035, speedY: 0.0028, phaseX: 2.1,  phaseY: 1.4  },  // yellow-green
      { hueBase: 150, px: 0.10, py: 0.70, speedX: 0.0029, speedY: 0.0033, phaseX: 3.5,  phaseY: 2.1  },  // green
      { hueBase: 200, px: 0.45, py: 0.10, speedX: 0.0038, speedY: 0.0025, phaseX: 1.0,  phaseY: 3.2  },  // cyan
      { hueBase: 240, px: 0.88, py: 0.55, speedX: 0.0024, speedY: 0.0037, phaseX: 4.2,  phaseY: 0.8  },  // blue
      { hueBase: 280, px: 0.30, py: 0.85, speedX: 0.0033, speedY: 0.0029, phaseX: 2.7,  phaseY: 3.8  },  // purple
      { hueBase: 320, px: 0.70, py: 0.40, speedX: 0.0041, speedY: 0.0022, phaseX: 0.6,  phaseY: 1.9  },  // pink
    ]

    /* ── Get color at position — blends all 8 anchors ───────── */
    const getHue = (x, y, t) => {
      let sumW = 0, sumSin = 0, sumCos = 0
      ANCHORS.forEach(a => {
        const ax = W * (a.px + 0.12 * Math.sin(t * a.speedX + a.phaseX))
        const ay = H * (a.py + 0.12 * Math.cos(t * a.speedY + a.phaseY))
        const dx = x - ax, dy = y - ay
        // Slowly drift anchor hue through full spectrum
        const h  = (a.hueBase + t * 0.035) % 360
        const w  = 1 / (dx*dx + dy*dy + 8000)
        sumW    += w
        sumSin  += w * Math.sin(h * Math.PI / 180)
        sumCos  += w * Math.cos(h * Math.PI / 180)
      })
      const avgH = Math.atan2(sumSin / sumW, sumCos / sumW) * 180 / Math.PI
      return (avgH + 360) % 360
    }

    let t = 0, id

    const draw = () => {
      t++

      /* ── 1. BLACK BASE ─────────────────────────────────────── */
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(0,0,0,0.88)'     // slight trail = motion blur
      ctx.fillRect(0, 0, W, H)

      /* ── 2. BACKGROUND COLOR BLOBS — VIVID ─────────────────── */
      ANCHORS.forEach(a => {
        const ax = W * (a.px + 0.12 * Math.sin(t * a.speedX + a.phaseX))
        const ay = H * (a.py + 0.12 * Math.cos(t * a.speedY + a.phaseY))
        const h  = (a.hueBase + t * 0.035) % 360
        const r  = W * (0.30 + 0.06 * Math.sin(t * 0.002 + a.phaseX))

        const g = ctx.createRadialGradient(ax, ay, 0, ax, ay, r)
        g.addColorStop(0,    `hsla(${h},100%,28%,0.55)`)   // vivid center
        g.addColorStop(0.35, `hsla(${h},100%,18%,0.32)`)
        g.addColorStop(0.70, `hsla(${h}, 90%,10%,0.14)`)
        g.addColorStop(1,    `hsla(${h}, 80%, 4%,0)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
      })

      /* ── 3. NEURAL NETWORK ──────────────────────────────────── */
      // Update mouse node
      const mp = pts[pts.length - 1]
      mp.x += (mouse.x - mp.x) * 0.09
      mp.y += (mouse.y - mp.y) * 0.09
      mp.baseHue = (mp.baseHue + 0.8) % 360

      // Connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const d  = Math.sqrt(dx*dx + dy*dy)
          const MAX = pts[i].isMouse || pts[j].isMouse ? 210 : 135

          if (d < MAX) {
            const a  = (1 - d / MAX) * 0.65
            const hi = getHue(pts[i].x, pts[i].y, t)
            const hj = getHue(pts[j].x, pts[j].y, t)
            const hm = (hi + hj) / 2

            const grad = ctx.createLinearGradient(pts[i].x, pts[i].y, pts[j].x, pts[j].y)
            grad.addColorStop(0,   `hsla(${hi},100%,70%,${a})`)
            grad.addColorStop(0.5, `hsla(${hm},100%,75%,${a * 0.8})`)
            grad.addColorStop(1,   `hsla(${hj},100%,70%,${a * 0.5})`)
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = grad
            ctx.lineWidth = pts[i].isMouse || pts[j].isMouse ? 1.6 : 0.85
            ctx.stroke()
          }
        }
      }

      // Nodes
      pts.forEach(p => {
        if (!p.isMouse) {
          p.x += p.vx; p.y += p.vy
          if (p.x < 0 || p.x > W) p.vx *= -1
          if (p.y < 0 || p.y > H) p.vy *= -1
        }

        const h     = getHue(p.x, p.y, t)
        const pulse = 0.70 + 0.30 * Math.sin(t * p.pSpeed * 55 + p.phase)
        const r     = p.r * pulse

        // Wide halo glow
        const gr = r * (p.isMouse ? 8 : 6)
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr)
        glow.addColorStop(0,   `hsla(${h},100%,75%,${p.isMouse ? 0.65 : 0.30})`)
        glow.addColorStop(0.4, `hsla(${h},100%,60%,${p.isMouse ? 0.25 : 0.10})`)
        glow.addColorStop(1,   `hsla(${h},100%,45%,0)`)
        ctx.beginPath()
        ctx.arc(p.x, p.y, gr, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // Bright core
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${h},100%,88%,${0.75 + 0.25 * pulse})`
        ctx.shadowColor = `hsl(${h},100%,70%)`
        ctx.shadowBlur  = p.isMouse ? 28 : 14
        ctx.fill()
        ctx.shadowBlur = 0
      })

      /* ── 4. SCANLINE OVERLAY (subtle grid effect) ───────────── */
      ctx.globalCompositeOperation = 'overlay'
      const scanAlpha = 0.025
      for (let y2 = 0; y2 < H; y2 += 4) {
        ctx.fillStyle = `rgba(0,0,0,${scanAlpha})`
        ctx.fillRect(0, y2, W, 2)
      }
      ctx.globalCompositeOperation = 'source-over'

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
