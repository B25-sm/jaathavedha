import { useEffect, useRef } from 'react'

export default function LeoParticles({ count = 25, className = '' }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.innerHTML = ''
    for (let i = 0; i < count; i += 1) {
      const dot = document.createElement('div')
      const size = Math.random() * 3 + 1
      const x = Math.random() * 100
      const delay = Math.random() * 8
      const duration = Math.random() * 6 + 6
      const opacity = Math.random() * 0.4 + 0.1
      dot.style.cssText = `
        position:absolute;width:${size}px;height:${size}px;border-radius:50%;
        background:#F5C842;left:${x}%;bottom:-10px;opacity:0;
        animation:leo-float ${duration}s ease-in ${delay}s infinite;
        pointer-events:none;--p-opacity:${opacity};
      `
      container.appendChild(dot)
    }
  }, [count])

  return <div ref={containerRef} className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} aria-hidden="true" />
}
