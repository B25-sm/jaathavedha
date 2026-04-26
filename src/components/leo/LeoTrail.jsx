import { useEffect } from 'react'

export default function LeoTrail() {
  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return undefined

    const handler = (e) => {
      const particle = document.createElement('div')
      particle.className = 'leo-trail-particle'
      particle.style.cssText = `
        position:fixed;width:6px;height:6px;border-radius:50%;background:#F5C842;
        pointer-events:none;z-index:9999;left:${e.clientX}px;top:${e.clientY}px;
        transform:translate(-50%,-50%);animation:trail-fade .6s ease-out forwards;
      `
      document.body.appendChild(particle)
      setTimeout(() => particle.remove(), 600)
    }

    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  return null
}
