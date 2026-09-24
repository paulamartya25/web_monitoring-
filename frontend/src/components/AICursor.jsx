import { useEffect, useRef, useState } from 'react'

const TRAIL_LENGTH = 14

export default function AICursor() {
  const dotRef   = useRef(null)
  const ringRef  = useRef(null)
  const [trail, setTrail] = useState([])
  const [clicking, setClicking] = useState(false)
  const [hovering, setHovering] = useState(false)

  const mouse  = useRef({ x: -200, y: -200 })
  const ring   = useRef({ x: -200, y: -200 })
  const rafId  = useRef(null)

  useEffect(() => {
    const onMove = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY }

      // Move dot instantly
      if (dotRef.current) {
        dotRef.current.style.left = e.clientX + 'px'
        dotRef.current.style.top  = e.clientY + 'px'
      }

      // Add trail point
      setTrail(prev => [
        { x: e.clientX, y: e.clientY, id: Date.now() + Math.random() },
        ...prev.slice(0, TRAIL_LENGTH - 1),
      ])

      // Check if hovering interactive element
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const isClickable = el?.closest('button, a, input, select, textarea, [role="button"]')
      setHovering(!!isClickable)
    }

    const onDown = () => setClicking(true)
    const onUp   = () => setClicking(false)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup',   onUp)

    // Smooth-follow ring via RAF
    const animate = () => {
      ring.current.x += (mouse.current.x - ring.current.x) * 0.13
      ring.current.y += (mouse.current.y - ring.current.y) * 0.13
      if (ringRef.current) {
        ringRef.current.style.left = ring.current.x + 'px'
        ringRef.current.style.top  = ring.current.y + 'px'
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

  const ringSize = hovering ? 44 : clicking ? 20 : 32

  return (
    <>
      {/* Neural trail particles */}
      {trail.map((p, i) => {
        const scale = 1 - i / TRAIL_LENGTH
        const size  = Math.max(1.5, 5 * scale)
        const alpha = Math.max(0, 0.7 * scale)
        return (
          <div
            key={p.id}
            className="fixed pointer-events-none"
            style={{
              zIndex: 9997,
              left:   p.x,
              top:    p.y,
              width:  size,
              height: size,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              background: `rgba(99,102,241,${alpha})`,
              boxShadow: `0 0 ${size * 2}px rgba(99,102,241,${alpha * 0.8})`,
              transition: 'opacity 0.3s',
            }}
          />
        )
      })}

      {/* Scanning ring — smooth follow */}
      <div
        ref={ringRef}
        className="fixed pointer-events-none"
        style={{
          zIndex: 9998,
          width:  ringSize,
          height: ringSize,
          border: hovering
            ? '2px solid rgba(129,140,248,0.9)'
            : '1.5px solid rgba(99,102,241,0.65)',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          transition: 'width 0.2s, height 0.2s, border 0.2s',
          boxShadow: hovering
            ? '0 0 12px rgba(99,102,241,0.6), inset 0 0 8px rgba(99,102,241,0.15)'
            : '0 0 6px rgba(99,102,241,0.35)',
        }}
      >
        {/* Scanner sweep line */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: '45%', height: 1,
          background: 'linear-gradient(to right, rgba(99,102,241,0.9), transparent)',
          transformOrigin: 'left center',
          animation: 'scanSweep 2s linear infinite',
        }} />
      </div>

      {/* Center dot — instant follow */}
      <div
        ref={dotRef}
        className="fixed pointer-events-none"
        style={{
          zIndex:       9999,
          width:        clicking ? 8 : hovering ? 6 : 4,
          height:       clicking ? 8 : hovering ? 6 : 4,
          borderRadius: '50%',
          transform:    'translate(-50%, -50%)',
          background:   '#a5b4fc',
          boxShadow:    '0 0 6px #6366f1, 0 0 18px rgba(99,102,241,0.6)',
          transition:   'width 0.12s, height 0.12s',
        }}
      />
    </>
  )
}
