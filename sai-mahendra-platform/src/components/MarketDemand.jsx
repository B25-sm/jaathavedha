import { useEffect, useRef, useState } from 'react'
import { TrendingUp, Briefcase, Users, Globe, ArrowUpRight } from 'lucide-react'

/* ─── Count-up ───────────────────────────────────────────────────── */
function CountUp({ end, suffix = '', delay = 0 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        setTimeout(() => {
          const steps = 60
          const inc = end / steps
          let cur = 0
          const t = setInterval(() => {
            cur += inc
            if (cur >= end) { setCount(end); clearInterval(t) }
            else setCount(Math.floor(cur))
          }, 1800 / steps)
        }, delay)
        observer.disconnect()
      }
    }, { threshold: 0.2 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [end, delay])

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

/* ─── Progress bar ───────────────────────────────────────────────── */
function Bar({ label, value, suffix = '%', source, delay = 0 }) {
  const [w, setW] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setTimeout(() => setW(value), delay); observer.disconnect() }
    }, { threshold: 0.2 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [value, delay])

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-primary)] text-sm font-medium">{label}</span>
        <span className="text-[var(--leo-sunlit)] font-bold text-sm tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
          {w > 0 ? value : 0}{suffix}
        </span>
      </div>
      <div className="h-[3px] w-full rounded-full bg-[rgba(201,146,42,0.12)]">
        <div
          style={{ width: `${w}%`, transition: 'width 1.6s cubic-bezier(0.22,1,0.36,1)' }}
          className="h-full rounded-full bg-gradient-to-r from-[var(--leo-amber)] to-[var(--leo-sunlit)]"
        />
      </div>
      <span className="text-[var(--text-muted)] text-xs">{source}</span>
    </div>
  )
}

/* ─── Data ───────────────────────────────────────────────────────── */
const macroStats = [
  { icon: Briefcase, value: 10,      suffix: 'x',  label: 'More AI jobs than engineers',        sub: 'For every 1 AI-ready developer, 10 companies are waiting to hire.',         source: 'techlifeadventures.com · 2026', delay: 0   },
  { icon: Users,     value: 1000000, suffix: '+',  label: 'AI professionals needed by 2026',    sub: 'MeitY projects a 1 million AI professional shortage across India.',          source: 'Ministry of Electronics & IT · 2026', delay: 150 },
  { icon: TrendingUp,value: 17,      suffix: 'B$', label: 'Indian AI market size by 2027',      sub: 'Growing at 25–35% CAGR — the fastest expanding tech sector in the country.', source: 'Scaler / Industry Reports · 2026', delay: 300 },
  { icon: Globe,     value: 500000,  suffix: '+',  label: 'New GCC positions opening in India', sub: 'Global Capability Centers are the #1 driver of high-skill tech hiring.',      source: 'zyoin.com India Tech Hiring · 2026', delay: 450 },
]

const bars = [
  { label: 'React — active developer adoption worldwide',        value: 44, suffix: '%',  source: 'Stack Overflow Developer Survey · 2026',    delay: 0   },
  { label: 'Node.js — share of global backend infrastructure',  value: 48, suffix: '%',  source: 'nucamp.co Full-Stack Report · 2026',         delay: 80  },
  { label: 'Python — year-over-year growth in hiring demand',   value: 35, suffix: '%↑', source: 'gloroots.com Top Developer Skills · 2026',   delay: 160 },
  { label: 'Java / Spring Boot — share of enterprise postings', value: 78, suffix: '%',  source: 'bswen.com Java Job Market · 2026',           delay: 240 },
  { label: 'AI + Fullstack hybrid — fastest-growing role type', value: 91, suffix: '%',  source: 'LinkedIn Emerging Jobs Report · 2026',       delay: 320 },
]

const jds = [
  {
    type: 'Product Startup · Series B',
    role: 'Fullstack Engineer',
    tags: ['React', 'Node.js', 'REST APIs', 'AI Integration'],
    quote: '"Must have experience with React and Node.js. Bonus: familiarity with LangChain or AI workflow tools."',
  },
  {
    type: 'GCC / MNC · Bangalore',
    role: 'Java Backend Developer',
    tags: ['Spring Boot', 'Microservices', 'AI APIs', 'REST'],
    quote: '"3+ years Spring Boot. Experience integrating AI/ML APIs into enterprise systems is a strong plus."',
  },
  {
    type: 'AI-First SaaS Company',
    role: 'Python Fullstack + AI Developer',
    tags: ['Python', 'FastAPI', 'LangChain', 'n8n'],
    quote: '"Build and deploy AI-powered features using Python backend + LangChain. n8n automation experience preferred."',
  },
]

const verdictRows = [
  { label: 'IT roles requiring Fullstack skills',  value: '90%+' },
  { label: 'Premium roles requiring AI capability', value: '100%' },
  { label: 'Time to learn at Leovex',               value: '4 Weeks' },
  { label: 'Starting investment',                   value: '₹499' },
]

/* ─── Section ────────────────────────────────────────────────────── */
export default function MarketDemand() {
  return (
    <section id="market-demand" className="py-28 px-4 leo-section-dark">
      <div className="max-w-6xl mx-auto space-y-20">

        {/* ── 1. Header ── */}
        <div className="max-w-3xl">
          <span className="block text-[var(--leo-amber)] text-xs font-semibold uppercase tracking-[0.2em] mb-5">
            Market Intelligence · 2026
          </span>
          <h2
            className="text-4xl sm:text-5xl font-bold leading-[1.15] mb-5"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            These Skills Are Not Outdated.{' '}
            <span className="gradient-text">They Are the Market.</span>
          </h2>
          <p className="text-[var(--text-secondary)] text-lg leading-relaxed">
            Real hiring data from LinkedIn, Naukri, MeitY, and Stack Overflow. Every technology in the Leovex curriculum is actively in demand — right now and through 2027.
          </p>
        </div>

        {/* ── 2. Macro stats — 4 cards in a clean grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[rgba(201,146,42,0.15)] rounded-2xl overflow-hidden border border-[var(--border-gold)]">
          {macroStats.map(({ icon: Icon, value, suffix, label, sub, source, delay }) => (
            <div key={label} className="bg-[var(--bg-card)] p-7 flex flex-col gap-4">
              <Icon size={20} className="text-[var(--leo-amber)]" strokeWidth={1.5} />
              <div
                className="text-4xl sm:text-5xl font-bold gradient-text leading-none"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <CountUp end={value} suffix={suffix} delay={delay} />
              </div>
              <div>
                <p className="text-[var(--text-primary)] font-semibold text-sm leading-snug mb-1">{label}</p>
                <p className="text-[var(--text-secondary)] text-xs leading-relaxed">{sub}</p>
              </div>
              <p className="text-[var(--text-muted)] text-xs mt-auto pt-3 border-t border-[rgba(201,146,42,0.12)]">
                {source}
              </p>
            </div>
          ))}
        </div>

        {/* ── 3. Two-column: bars + JDs ── */}
        <div className="grid lg:grid-cols-[1fr_1px_1fr] gap-0">

          {/* Left — bars */}
          <div className="pr-0 lg:pr-12">
            <p className="text-[var(--leo-amber)] text-xs font-semibold uppercase tracking-[0.18em] mb-2">Stack Demand Index</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              How Dominant Are These Skills?
            </h3>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-10">
              Market share and demand metrics for every technology in the Leovex curriculum — sourced from 2026 industry reports.
            </p>
            <div className="flex flex-col gap-7">
              {bars.map((b) => <Bar key={b.label} {...b} />)}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block bg-[rgba(201,146,42,0.15)] mx-8" />

          {/* Right — JDs */}
          <div className="mt-12 lg:mt-0 pl-0 lg:pl-12">
            <p className="text-[var(--leo-amber)] text-xs font-semibold uppercase tracking-[0.18em] mb-2">Live Job Descriptions</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              What Companies Are Asking For
            </h3>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-10">
              Representative JDs from active 2026 postings across LinkedIn, Naukri, and company career pages.
            </p>
            <div className="flex flex-col gap-4">
              {jds.map(({ type, role, tags, quote }) => (
                <div
                  key={role}
                  className="leo-card rounded-xl p-5 flex flex-col gap-3 border-l-[3px] border-[var(--leo-amber)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[var(--text-primary)] font-bold text-sm" style={{ fontFamily: 'var(--font-display)' }}>{role}</p>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5">{type}</p>
                    </div>
                    <ArrowUpRight size={14} className="text-[var(--leo-amber)] shrink-0 mt-0.5" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded text-xs font-medium bg-[rgba(201,146,42,0.1)] text-[var(--leo-amber)] border border-[var(--border-gold)]">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-[var(--text-secondary)] text-xs leading-relaxed italic border-t border-[rgba(201,146,42,0.1)] pt-3">
                    {quote}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 4. Verdict — full-width, editorial ── */}
        <div className="border border-[var(--border-gold)] rounded-2xl overflow-hidden">
          <div className="bg-[rgba(201,146,42,0.06)] px-8 py-4 border-b border-[var(--border-gold)]">
            <span className="text-[var(--leo-amber)] text-xs font-semibold uppercase tracking-[0.18em]">
              Research Summary · The Verdict
            </span>
          </div>
          <div className="grid lg:grid-cols-[1fr_auto] gap-0">
            {/* Left text */}
            <div className="p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-[var(--border-gold)]">
              <h3
                className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] leading-tight mb-5"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                90%+ of IT job openings still require Fullstack skills.{' '}
                <span className="gradient-text">The ones that pay the most now also require AI.</span>
              </h3>
              <p className="text-[var(--text-secondary)] text-base leading-relaxed max-w-xl">
                The question is not whether these skills are relevant. The question is whether you have them. At Leovex, you will — in 4 weeks, at a fraction of the cost, with AI built into every single track.
              </p>
            </div>
            {/* Right table */}
            <div className="p-8 lg:p-10 min-w-[260px]">
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-5 font-semibold">Key Figures</p>
              <div className="flex flex-col">
                {verdictRows.map(({ label, value }, i) => (
                  <div
                    key={label}
                    className={`flex items-center justify-between py-4 ${i < verdictRows.length - 1 ? 'border-b border-[rgba(201,146,42,0.12)]' : ''}`}
                  >
                    <span className="text-[var(--text-secondary)] text-sm">{label}</span>
                    <span className="font-bold gradient-text text-base ml-6" style={{ fontFamily: 'var(--font-display)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
