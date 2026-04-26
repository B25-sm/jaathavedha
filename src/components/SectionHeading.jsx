import { useEffect, useRef, useState } from 'react'

export default function SectionHeading({ tag, title, subtitle, center = true }) {
  const headingRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = headingRef.current
    if (!node) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={`mb-12 ${center ? 'text-center' : ''}`}>
      {tag && (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[rgba(201,146,42,0.15)] text-[var(--leo-amber)] border border-[var(--border-gold)] mb-4 uppercase tracking-[0.08em]">
          {tag}
        </span>
      )}
      <h2
        ref={headingRef}
        className={`leo-section-heading text-3xl sm:text-4xl font-semibold mb-4 ${visible ? 'is-visible' : ''}`}
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg max-w-2xl mx-auto leading-relaxed text-[var(--text-secondary)]">{subtitle}</p>
      )}
    </div>
  )
}
