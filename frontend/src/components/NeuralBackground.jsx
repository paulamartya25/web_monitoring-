import { useEffect, useRef } from 'react'

const BLUE   = [59,130,246]   // #3b82f6
const CYAN   = [6,182,212]    // #06b6d4
const PURPLE = [139,92,246]   // #8b5cf6
const WHITE  = [226,232,240]  // #e2e8f0

const PALETTES = [BLUE, CYAN, PURPLE, WHITE, BLUE, CYAN, BLUE, PURPLE]

function randColor() {
  const c = PALETTES[Math.floor(Math.random() * PALETTES.length)]
  return c
}

export default function NeuralBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W = window.innerWidth, H = window.innerHeight
    canvas.width = W; canvas.height = H

    const mouse = { x: W/2, y: H/2 }
    const onMouse = e => { mouse.x = e.clientX; mouse.y = e.clientY }
    window.addEventListener('mousemove', onMouse)

    const NUM = 70
    const pts = Array.from({ length: NUM }, () => {
      const c = randColor()
      return {
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        r: Math.random() * 2.2 + 0.7,
        c, phase: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.02,
      }
    })
    // Mouse node
    pts.push({ x: mouse.x, y: mouse.y, vx:0, vy:0, r:4, c: CYAN, isMouse:true, phase:0, speed:0.04 })

    let t = 0, id
    const draw = () => {
      t += 0.016
      ctx.clearRect(0, 0, W, H)

      const mp = pts[pts.length - 1]
      mp.x += (mouse.x - mp.x) * 0.09
      mp.y += (mouse.y - mp.y) * 0.09

      // Draw connections first (under nodes)
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const d  = Math.sqrt(dx*dx + dy*dy)
          const MAX = pts[i].isMouse || pts[j].isMouse ? 180 : 130
          if (d < MAX) {
            const a = (1 - d / MAX) * 0.35
            const ci = pts[i].c, cj = pts[j].c
            const grad = ctx.createLinearGradient(pts[i].x,pts[i].y,pts[j].x,pts[j].y)
            grad.addColorStop(0, `rgba(${ci[0]},${ci[1]},${ci[2]},${a})`)
            grad.addColorStop(1, `rgba(${cj[0]},${cj[1]},${cj[2]},${a * 0.5})`)
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = grad
            ctx.lineWidth = pts[i].isMouse || pts[j].isMouse ? 1.2 : 0.7
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

        const pulse = 0.7 + 0.3 * Math.sin(t * p.speed * 60 + p.phase)
        const r = p.r * pulse
        const [cr,cg,cb] = p.c

        // Outer glow
        const grd = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*5)
        grd.addColorStop(0, `rgba(${cr},${cg},${cb},${p.isMouse ? 0.5 : 0.25})`)
        grd.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
        ctx.beginPath()
        ctx.arc(p.x, p.y, r*5, 0, Math.PI*2)
        ctx.fillStyle = grd
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI*2)
        ctx.fillStyle = p.isMouse
          ? `rgba(${cr},${cg},${cb},0.95)`
          : `rgba(${cr},${cg},${cb},${0.6 + 0.4 * pulse})`
        ctx.shadowColor = `rgb(${cr},${cg},${cb})`
        ctx.shadowBlur  = p.isMouse ? 20 : 8
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
      position:'fixed', top:0, left:0,
      width:'100vw', height:'100vh',
      zIndex:0, pointerEvents:'none', opacity:0.55,
    }}/>
  )
}
