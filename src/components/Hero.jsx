import { useEffect, useState } from 'react'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from './Button'
import LeoParticles from './leo/LeoParticles'
import lion3D from '../assets/leo-lion-3d.png'

const heroSkills = [
  'Fullstack',
  'Java Fullstack',
  'Python Fullstack',
  'AI Workflow',
  'AI Agent',
  'MERN Stack',
  'Placement Assistance',
]

export default function Hero() {
  const [skillIndex, setSkillIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setSkillIndex((prev) => (prev + 1) % heroSkills.length)
    }, 3600)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="leo-hero relative min-h-screen flex items-center justify-center px-4 pt-16 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[rgba(201,146,42,0.14)] rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-[rgba(245,200,66,0.08)] rounded-full blur-3xl" />
      </div>
      <LeoParticles count={28} />

      <div className="relative max-w-6xl w-full mx-auto grid lg:grid-cols-2 gap-10 items-center">
        <div className="text-center lg:text-left">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(201,146,42,0.12)] border border-[var(--border-gold)] text-[var(--leo-amber)] text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-[var(--leo-sunlit)] animate-pulse" />
          Fullstack + AI Training — Practical & Affordable
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--leo-sunlit)' }}>
          Learn Fullstack + AI{' '}
          <span className="gradient-text">with Clarity</span>
          <br />
          and Real Projects
        </h1>

        {/* Subtext */}
        <p className="text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed">
          Skip months of confusion. Learn what actually matters — from React to AI Agents — with structured programs starting at just{' '}
          <span className="text-[var(--text-primary)] font-semibold">₹499</span>.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
          <Link to="/programs">
            <Button variant="primary" className="text-base px-8 py-4">
              View Programs <ArrowRight size={18} />
            </Button>
          </Link>
          <Button
            variant="whatsapp"
            href="https://wa.me/9063443115?text=Hi%20Leovex%2C%20I%20want%20to%20enroll!"
            className="text-base px-8 py-4"
          >
            <MessageCircle size={18} />
            Chat on WhatsApp
          </Button>
        </div>

        {/* Social proof strip */}
        <div className="mt-16 flex flex-wrap items-center justify-center lg:justify-start gap-8 text-sm text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold gradient-text" style={{ fontFamily: 'var(--font-display)' }}>4 Weeks</span>
            <span>Job-Ready</span>
          </div>
          <div className="w-px h-6 bg-[var(--border-gold)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold gradient-text" style={{ fontFamily: 'var(--font-display)' }}>Max 10</span>
            <span>Per Batch</span>
          </div>
          <div className="w-px h-6 bg-[var(--border-gold)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold gradient-text" style={{ fontFamily: 'var(--font-display)' }}>₹499</span>
            <span>Starting Price</span>
          </div>
          <div className="w-px h-6 bg-[var(--border-gold)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold gradient-text" style={{ fontFamily: 'var(--font-display)' }}>100x</span>
            <span>Faster Learning</span>
          </div>
        </div>
      </div>
        <div className="hidden lg:flex justify-center">
          <div className="leo-hero-3d-wrap">
            <div className="absolute inset-10 rounded-full bg-[radial-gradient(circle,rgba(245,200,66,0.18)_0%,rgba(245,200,66,0.04)_45%,transparent_70%)] blur-xl" />
            <div className="leo-flip-card w-80 h-80">
              <div className="leo-flip-inner">
                <div className="leo-flip-face leo-flip-front">
                  <img
                    src={lion3D}
                    alt="Golden lion"
                    className="leo-lion-image w-80 h-80 object-cover rounded-[2rem] border border-[var(--border-gold)]"
                  />
                </div>
                <div className="leo-flip-face leo-flip-back">
                  <div className="leo-skill-back-content">
                    <span className="leo-skill-back-label">Skill Focus</span>
                    <span className="leo-skill-back-name" key={heroSkills[skillIndex]}>
                      {heroSkills[skillIndex]}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
