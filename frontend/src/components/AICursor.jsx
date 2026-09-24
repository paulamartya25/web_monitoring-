import { useEffect, useRef, useState } from 'react'

const TRAIL = 24

export default function AICursor() {
  const dotRef  = useRef(null)
  const ringRef = useRef(null)
  const mouse   = useRef({ x: -300, y: -300 })
  const ring    = useRef({ x: -300, y: -300 })
  const hue     = useRef(200)           // start at blue
  const lastPos = useRef({ x: -300, y: -300 })
  const rafId   = useRef(null)
  const [trail, setTrail]     = useState([])
  const [clicking, setClicking] = useState(false)

  useEffect(() => {
    const onMove = (e) => {
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      const speed = Math.sqrt(dx * dx + dy * dy)
      lastPos.current = { x: e.clientX, y: e.clientY }
      mouse.current   = { x: e.clientX, y: e.clientY }

      // Hue advances faster when moving faster → rainbow nitro
      hue.current = (hue.current + Math.max(3, speed * 0.6)) % 360

      // Move dot instantly
      if (dotRef.current) {
        const h = Math.round(hue.current)
        dotRef.current.style.left = e.clientX + 'px'
        dotRef.current.style.top  = e.clientY + 'px'
        dotRef.current.style.boxShadow = `
          0 0 8px hsl(${h},100%,75%),
          0 0 22px hsl(${h},100%,60%),
          0 0 45px hsl(${(h+40)%360},100%,55%,0.6)
        `
      }

      setTrail(prev => [
        {
          x: e.clientX, y: e.clientY,
          id: performance.now() + Math.random(),
          hue: hue.current,
          speed: Math.min(speed, 50),
        },
        ...prev.slice(0, TRAIL - 1),
      ])
    }

    const onDown = () => setClicking(true)
    const onUp   = () => setClicking(false)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup',   onUp)

    // Smooth ring follow + live color update
    const animate = () => {
      ring.current.x += (mouse.current.x - ring.current.x) * 0.11
      ring.current.y += (mouse.current.y - ring.current.y) * 0.11

      if (ringRef.current) {
        ringRef.current.style.left = ring.current.x + 'px'
        ringRef.current.style.top  = ring.current.y + 'px'
        const h  = Math.round(hue.current)
        const h2 = (h + 90) % 360
        const h3 = (h + 180) % 360
        ringRef.current.style.borderColor = `hsl(${h},100%,65%)`
        ringRef.current.style.boxShadow   = `
          0 0 10px hsl(${h},100%,60%),
          0 0 22px hsl(${h2},100%,55%),
          0 0 40px hsl(${h3},100%,45%),
          inset 0 0 10px hsl(${h},100%,45%,0.25)
        `
      }
      rafId.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup',   onUp)
      cancelAnimationFrame(rafId.current)
    }
  }, [])

  return (
    <>
      {/* ── Nitro chromatic trail ── */}
      {trail.map((p, i) => {
        const t     = 1 - i / TRAIL
        const eased = t * t                            // quadratic ease
        const size  = Math.max(1.5, (7 + p.speed * 0.22) * eased)
        const alpha = eased * 0.9
        const h     = (Math.round(p.hue) - i * 9 + 720) % 360
        const h2    = (h + 60) % 360

        return (
          <div key={p.id} style={{
            position:      'fixed',
            pointerEvents: 'none',
            zIndex:        9996,
            left:          p.x,
            top:           p.y,
            width:         size,
            height:        size,
            borderRadius:  '50%',
            transform:     'translate(-50%,-50%)',
            background:    `hsl(${h},100%,68%)`,
            boxShadow: `
              0 0 ${size * 2}px hsl(${h},100%,65%),
              0 0 ${size * 5}px hsl(${h2},100%,55%,0.6),
              0 0 ${size * 8}px hsl(${h2},100%,45%,0.3)
            `,
            opacity:       alpha,
            mixBlendMode:  'screen',
          }} />
        )
      })}

      {/* Chromatic aberration ghost (slight offset R/B glow) */}
      {trail.slice(0, 4).map((p, i) => (
        <div key={`chr-${p.id}`} style={{
          position: 'fixed', pointerEvents: 'none', zIndex: 9995,
          left: p.x + (i + 1) * 2, top: p.y,
          width: 4, height: 4,
          borderRadius: '50%',
          transform: 'translate(-50%,-50%)',
          background: `hsl(0,100%,65%)`,
          opacity: 0.15,
          mixBlendMode: 'screen',
        }} />
      ))}
      {trail.slice(0, 4).map((p, i) => (
        <div key={`chb-${p.id}`} style={{
          position: 'fixed', pointerEvents: 'none', zIndex: 9995,
          left: p.x - (i + 1) * 2, top: p.y,
          width: 4, height: 4,
          borderRadius: '50%',
          transform: 'translate(-50%,-50%)',
          background: `hsl(210,100%,65%)`,
          opacity: 0.15,
          mixBlendMode: 'screen',
        }} />
      ))}

      {/* ── Scanning ring — smooth follow, live rainbow border ── */}
      <div ref={ringRef} style={{
        position:      'fixed',
        pointerEvents: 'none',
        zIndex:        9998,
        width:         clicking ? 22 : 34,
        height:        clicking ? 22 : 34,
        borderRadius:  '50%',
        border:        '1.5px solid #60a5fa',
        transform:     'translate(-50%,-50%)',
        transition:    'width 0.15s, height 0.15s',
      }}>
        {/* Sweep line inside ring */}
        <div style={{
          position:        'absolute',
          top:             '50%', left: '50%',
          width:           '46%', height: 1.5,
          background:      'linear-gradient(to right, rgba(255,255,255,0.95), transparent)',
          transformOrigin: 'left center',
          animation:       'scanSweep 1.4s linear infinite',
        }}/>
      </div>

      {/* ── Center dot — instant follow, rainbow glow ── */}
      <div ref={dotRef} style={{
        position:      'fixed',
        pointerEvents: 'none',
        zIndex:        9999,
        width:         clicking ? 9 : 5,
        height:        clicking ? 9 : 5,
        borderRadius:  '50%',
        transform:     'translate(-50%,-50%)',
        background:    '#ffffff',
        transition:    'width 0.1s, height 0.1s',
      }}/>
    </>
  )
}
