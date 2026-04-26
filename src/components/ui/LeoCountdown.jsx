import { useEffect, useMemo, useState } from 'react'

function getTimeParts(targetDate) {
  const now = Date.now()
  const diff = Math.max(targetDate.getTime() - now, 0)
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  return { days, hours, minutes }
}

export default function LeoCountdown({ daysAhead = 9 }) {
  const target = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + daysAhead)
    return d
  }, [daysAhead])

  const [parts, setParts] = useState(getTimeParts(target))

  useEffect(() => {
    const timer = setInterval(() => setParts(getTimeParts(target)), 1000)
    return () => clearInterval(timer)
  }, [target])

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {[
        { label: 'Days', value: parts.days },
        { label: 'Hours', value: parts.hours },
        { label: 'Mins', value: parts.minutes },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-[var(--border-gold)] bg-[var(--bg-hover)] px-3 py-2 min-w-[70px]">
          <div
            className="text-xl font-bold gradient-text"
            style={{
              fontFamily: 'var(--font-display)',
              animation: 'crown-pulse 2.2s ease-in-out infinite',
            }}
          >
            {String(item.value).padStart(2, '0')}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.07em]">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
