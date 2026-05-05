import { useEffect, useState } from 'react'
import { ArrowRight, MessageCircle, Sparkles, Zap, Award, Users, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from './Button'
import LeoParticles from './leo/LeoParticles'
import lion3D from '../assets/leo-lion-3d.png'

const heroSkills = [
  'MERN Stack',
  'Java Fullstack',
  'Python Fullstack',
  'AI Agents',
  'AI Workflows',
  'Placement Assistance',
]

export default function Hero() {
  const [skillIndex, setSkillIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [displayedSkill, setDisplayedSkill] = useState(heroSkills[0])
  const [animationStage, setAnimationStage] = useState(0)

  useEffect(() => {
    setIsVisible(true)
    
    // PERFECT Cinematic FDE animation sequence - ALL LETTERS FAST
    const stage1 = setTimeout(() => setAnimationStage(1), 600)   // Show F
    const stage2 = setTimeout(() => setAnimationStage(2), 900)   // Show D (300ms after F)
    const stage3 = setTimeout(() => setAnimationStage(3), 1200)  // Show E (300ms after D)
    const stage4 = setTimeout(() => setAnimationStage(4), 2400)  // F expands
    const stage5 = setTimeout(() => setAnimationStage(5), 3300)  // D expands
    const stage6 = setTimeout(() => setAnimationStage(6), 4200)  // E expands
    
    // Update skill text when card is showing FRONT (lion), not back
    // Card animation: 0-22% front, 22-28% flip to back, 28-72% back, 72-78% flip to front, 78-100% front
    // Update at the END of cycle (after 78%, when front is visible again)
    const flipInterval = setInterval(() => {
      // Wait until card has flipped back to front (after 2808ms = 78% of 3600ms)
      // Update at 3200ms when front is fully visible
      setTimeout(() => {
        setSkillIndex((prev) => {
          const nextIndex = (prev + 1) % heroSkills.length
          setDisplayedSkill(heroSkills[nextIndex])
          return nextIndex
        })
      }, 3200)
    }, 3600)
    
    return () => {
      clearTimeout(stage1)
      clearTimeout(stage2)
      clearTimeout(stage3)
      clearTimeout(stage4)
      clearTimeout(stage5)
      clearTimeout(stage6)
      clearInterval(flipInterval)
    }
  }, [])

  return (
    <section className="leo-hero relative min-h-screen flex items-center justify-center px-6 sm:px-8 pt-24 pb-16 overflow-hidden">
      {/* Enhanced Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[rgba(201,146,42,0.15)] rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-[rgba(245,200,66,0.1)] rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[rgba(232,168,62,0.08)] rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      <LeoParticles count={28} />

      {/* Animated Grid Background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(var(--border-gold) 1px, transparent 1px), linear-gradient(90deg, var(--border-gold) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      <div className="relative max-w-7xl w-full mx-auto">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-16 lg:gap-24 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left space-y-6">
            {/* Premium Badge - Higher Position */}
            <div 
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{
                background: 'linear-gradient(135deg, rgba(201,146,42,0.12) 0%, rgba(245,200,66,0.08) 100%)',
                border: '1px solid rgba(245,200,66,0.3)',
                boxShadow: '0 4px 16px rgba(201,146,42,0.15)'
              }}
            >
              <TrendingUp size={14} className="text-[var(--leo-sunlit)]" />
              <span className="text-sm font-semibold text-[var(--leo-amber)] tracking-wide">The Future of Tech Hiring</span>
            </div>

            {/* Pre-headline: Hook with familiar terms */}
            <div 
              className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: '50ms' }}
            >
              <p className="text-xl sm:text-2xl text-[var(--text-secondary)] font-medium">
                Master <span className="text-[var(--leo-sunlit)] font-bold">Fullstack + AI</span> in <span className="text-[var(--leo-sunlit)] font-bold">4 Weeks</span>
              </p>
            </div>

            {/* MAIN HEADLINE - Smooth Sequential FDE Animation */}
            <div 
              className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ 
                transitionDelay: '100ms'
              }}
            >
              <h1 
                className="text-5xl sm:text-6xl lg:text-[4.5rem] xl:text-[5rem] font-bold leading-[1.1]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span className="text-[var(--text-primary)] block mb-4">
                  Become a
                </span>
              </h1>
              
              {/* Letters STAY - Rest emerges from them */}
              <div className="space-y-3">
                {/* Line 1: F stays, "orward" emerges */}
                <div className="overflow-hidden relative" style={{ minHeight: '5rem' }}>
                  {animationStage >= 1 && (
                    <div style={{ 
                      fontSize: 'clamp(3.5rem, 13vw, 7rem)', 
                      lineHeight: '1',
                      fontFamily: 'var(--font-display)',
                      position: 'relative',
                      display: 'inline-block'
                    }}>
                      {/* F stays fixed */}
                      <span className="gradient-text bg-gradient-to-r from-[var(--leo-gold)] via-[var(--leo-sunlit)] to-[var(--leo-amber)] bg-[length:200%_auto] bg-clip-text text-transparent font-extrabold animate-gradient"
                        style={{
                          animation: animationStage === 1 ? 'letter-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none'
                        }}
                      >
                        F
                      </span>
                      {/* "orward" emerges from F */}
                      {animationStage >= 4 && (
                        <span className="gradient-text bg-gradient-to-r from-[var(--leo-gold)] via-[var(--leo-sunlit)] to-[var(--leo-amber)] bg-[length:200%_auto] bg-clip-text text-transparent font-extrabold animate-gradient inline-block"
                          style={{
                            animation: 'rest-emerge 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
                            transformOrigin: 'left center',
                            willChange: 'transform, opacity'
                          }}
                        >
                          orward
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Line 2: D stays, "eployed" emerges */}
                <div className="overflow-hidden relative" style={{ minHeight: '5rem' }}>
                  {animationStage >= 2 && (
                    <div style={{ 
                      fontSize: 'clamp(3.5rem, 13vw, 7rem)', 
                      lineHeight: '1',
                      fontFamily: 'var(--font-display)',
                      position: 'relative',
                      display: 'inline-block'
                    }}>
                      {/* D stays fixed */}
                      <span className="gradient-text bg-gradient-to-r from-[var(--leo-gold)] via-[var(--leo-sunlit)] to-[var(--leo-amber)] bg-[length:200%_auto] bg-clip-text text-transparent font-extrabold animate-gradient"
                        style={{
                          animation: animationStage === 2 ? 'letter-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none'
                        }}
                      >
                        D
                      </span>
                      {/* "eployed" emerges from D */}
                      {animationStage >= 5 && (
                        <span className="gradient-text bg-gradient-to-r from-[var(--leo-gold)] via-[var(--leo-sunlit)] to-[var(--leo-amber)] bg-[length:200%_auto] bg-clip-text text-transparent font-extrabold animate-gradient inline-block"
                          style={{
                            animation: 'rest-emerge-graceful 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
                            transformOrigin: 'left center',
                            willChange: 'transform, opacity'
                          }}
                        >
                          eployed
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Line 3: E stays, "ngineer" emerges */}
                <div className="overflow-hidden relative" style={{ minHeight: '5rem' }}>
                  {animationStage >= 3 && (
                    <div style={{ 
                      fontSize: 'clamp(3.5rem, 13vw, 7rem)', 
                      lineHeight: '1',
                      fontFamily: 'var(--font-display)',
                      position: 'relative',
                      display: 'inline-block'
                    }}>
                      {/* E stays fixed */}
                      <span className="gradient-text bg-gradient-to-r from-[var(--leo-amber)] via-[var(--leo-sunlit)] to-[var(--leo-gold)] bg-[length:200%_auto] bg-clip-text text-transparent font-extrabold animate-gradient"
                        style={{
                          animation: animationStage === 3 ? 'letter-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none'
                        }}
                      >
                        E
                      </span>
                      {/* "ngineer" emerges from E */}
                      {animationStage >= 6 && (
                        <span className="gradient-text bg-gradient-to-r from-[var(--leo-amber)] via-[var(--leo-sunlit)] to-[var(--leo-gold)] bg-[length:200%_auto] bg-clip-text text-transparent font-extrabold animate-gradient inline-block"
                          style={{
                            animation: 'rest-emerge-magnificent 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
                            transformOrigin: 'left center',
                            willChange: 'transform, opacity'
                          }}
                        >
                          ngineer
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Simple explanation right under the animation */}
              <p className="text-lg sm:text-xl text-[var(--text-muted)] italic mt-4">
                Engineers who work on-site with clients, solving real problems
              </p>
            </div>

            {/* Supporting Text */}
            <p 
              className={`text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto lg:mx-0 leading-relaxed transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: '200ms' }}
            >
              Go from <span className="text-[var(--text-primary)] font-semibold">zero to hired</span> in <span className="text-[var(--leo-sunlit)] font-bold">4 weeks</span>. Master React, Node.js, Python, Java, and AI Agents. While others spend 8 months in theory, <span className="text-[var(--leo-sunlit)] font-bold">you'll be building real products and earning real money.</span>
            </p>

            {/* Why This Matters - Premium Insight Card */}
            <div 
              className={`relative group transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: '250ms' }}
            >
              {/* Gradient border wrapper */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[var(--leo-gold)] via-[var(--leo-sunlit)] to-[var(--leo-amber)] p-[1px] opacity-40 group-hover:opacity-60 transition-opacity duration-500">
                <div className="w-full h-full rounded-3xl" style={{ background: 'var(--bg-primary)' }} />
              </div>
              
              {/* Content */}
              <div className="relative p-8 rounded-3xl backdrop-blur-sm" style={{
                background: 'linear-gradient(135deg, rgba(201,146,42,0.08) 0%, rgba(31,26,14,0.6) 100%)',
              }}>
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--leo-gold)] to-[var(--leo-sunlit)] flex items-center justify-center shadow-xl relative overflow-hidden group-hover:scale-110 transition-transform duration-500">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <Award size={26} className="text-[var(--bg-primary)] relative z-10" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-xl font-bold text-[var(--leo-sunlit)]" style={{ fontFamily: 'var(--font-display)' }}>
                      Why Companies Fight Over These Engineers
                    </h3>
                    <p className="text-base text-[var(--text-secondary)] leading-relaxed">
                      Forget specialists who only know one thing. The market is <span className="text-[var(--leo-sunlit)] font-bold">starving for engineers who can do it all</span> — code, deploy, talk to customers, and <span className="text-[var(--text-primary)] font-semibold">ship products that actually make money.</span> You'll be the engineer every founder wishes they hired first.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-[var(--leo-amber)]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--leo-sunlit)] animate-pulse" />
                      <span className="font-semibold">Rare skills. High demand. Premium pay.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div 
              className={`flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: '300ms' }}
            >
              <Link to="/programs" className="group">
                <Button variant="primary" className="text-base px-9 py-4 relative overflow-hidden shadow-lg">
                  <span className="relative z-10 flex items-center gap-2 font-semibold">
                    See Programs 
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--leo-gold)] to-[var(--leo-sunlit)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Button>
              </Link>
              <Button
                variant="whatsapp"
                href="https://wa.me/9063443115?text=Hi%20Leovex%2C%20I%20want%20to%20become%20a%20Forward%20Deployed%20Engineer!"
                className="text-base px-9 py-4 group relative overflow-hidden shadow-lg"
              >
                <span className="relative z-10 flex items-center gap-2 font-semibold">
                  <MessageCircle size={18} className="group-hover:rotate-12 transition-transform duration-300" />
                  Claim Your Spot
                </span>
              </Button>
            </div>

            {/* Premium Stats Grid - Consistent Professional Design */}
            <div 
              className={`grid grid-cols-2 lg:grid-cols-4 gap-px bg-[rgba(245,200,66,0.08)] transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: '400ms' }}
            >
              {[
                { value: '4 Weeks', label: 'Zero to Hired', sublabel: 'Not 8 months' },
                { value: 'Max 10', label: 'Students Per Batch', sublabel: 'Elite cohort' },
                { value: '₹499', label: 'Start Now', sublabel: 'Pay as you learn' },
                { value: '100x', label: 'Return', sublabel: 'On your investment' }
              ].map((stat, index) => (
                <div
                  key={index}
                  className="group relative bg-[rgba(12,10,6,0.98)] hover:bg-[rgba(20,17,10,0.98)] transition-all duration-300"
                  style={{ transitionDelay: `${400 + index * 50}ms` }}
                >
                  {/* Content - Consistent spacing */}
                  <div className="relative px-6 py-9">
                    
                    {/* Value - Clean and bold */}
                    <div className="text-3xl lg:text-4xl font-bold mb-5 text-[var(--leo-sunlit)] leading-none group-hover:text-[var(--leo-gold)] transition-colors duration-300" style={{ fontFamily: 'var(--font-display)' }}>
                      {stat.value}
                    </div>
                    
                    {/* Label - Clear */}
                    <div className="text-sm font-semibold text-white mb-2 leading-tight">
                      {stat.label}
                    </div>
                    
                    {/* Sublabel - Subtle */}
                    <div className="text-xs text-[rgba(255,255,255,0.5)] leading-relaxed">
                      {stat.sublabel}
                    </div>
                  </div>

                  {/* Consistent hover accent - ALL cards same */}
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--leo-sunlit)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              ))}
            </div>
          </div>

          {/* Right Visual - Premium 3D Card */}
          <div 
            className={`hidden lg:flex justify-center lg:justify-end transition-all duration-1000 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
            style={{ transitionDelay: '500ms' }}
          >
            <div className="relative group">
              {/* Subtle glow */}
              <div className="absolute inset-0 rounded-full">
                <div className="absolute inset-10 rounded-full bg-[radial-gradient(circle,rgba(245,200,66,0.15)_0%,rgba(245,200,66,0.03)_45%,transparent_70%)] blur-3xl" />
              </div>

              {/* 3D Card */}
              <div className="leo-hero-3d-wrap relative">
                <div className="leo-flip-card w-96 h-96 hover:scale-[1.02] transition-transform duration-700">
                  <div className="leo-flip-inner">
                    <div className="leo-flip-face leo-flip-front relative overflow-hidden rounded-[2.5rem]">
                      {/* Premium gradient border */}
                      <div className="absolute inset-0 rounded-[2.5rem] p-[1px] bg-gradient-to-br from-[var(--leo-gold)] via-[var(--leo-sunlit)] to-[var(--leo-amber)]">
                        <div className="w-full h-full rounded-[2.5rem]" style={{ background: 'var(--bg-card)' }} />
                      </div>
                      
                      <img
                        src={lion3D}
                        alt="Forward Deployed Engineer"
                        className="leo-lion-image w-96 h-96 object-cover rounded-[2.5rem] relative z-10 group-hover:scale-105 transition-transform duration-1000"
                      />
                      
                      {/* Subtle shine */}
                      <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                        <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1500 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      </div>
                    </div>
                    <div className="leo-flip-face leo-flip-back rounded-[2.5rem]">
                      <div className="leo-skill-back-content relative">
                        <span className="leo-skill-back-label text-sm">Skill Focus</span>
                        <span className="leo-skill-back-name text-4xl animate-gradient bg-gradient-to-r from-[var(--leo-gold)] via-[var(--leo-sunlit)] to-[var(--leo-amber)] bg-[length:200%_auto] bg-clip-text text-transparent">
                          {displayedSkill}
                        </span>
                      </div>
                    </div>
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
