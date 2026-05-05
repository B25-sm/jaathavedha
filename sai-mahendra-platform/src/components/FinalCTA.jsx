import { ArrowRight, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from './Button'
import LeoParticles from './leo/LeoParticles'
import LeoCountdown from './ui/LeoCountdown'

export default function FinalCTA() {
  return (
    <section className="py-32 px-4 relative overflow-hidden">
      <LeoParticles count={30} />
      
      {/* Premium background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(201,146,42,0.03)] to-transparent" />
      
      <div className="max-w-4xl mx-auto text-center relative">
        {/* Ultra-premium card */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,200,66,0.15),transparent_70%)] blur-3xl" />
          
          {/* Main card */}
          <div className="relative bg-gradient-to-b from-[rgba(20,17,10,0.95)] to-[rgba(12,10,6,0.98)] border border-[rgba(245,200,66,0.2)] rounded-none p-12 sm:p-16 backdrop-blur-xl">
            
            {/* Headline - Bold and direct */}
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-none" style={{ fontFamily: 'var(--font-display)' }}>
              <span className="block text-white mb-2">Your Move.</span>
              <span className="block bg-gradient-to-r from-[var(--leo-gold)] via-[var(--leo-sunlit)] to-[var(--leo-amber)] bg-clip-text text-transparent">
                Start Now.
              </span>
            </h2>
            
            {/* Subheadline - Powerful and concise */}
            <p className="text-xl sm:text-2xl text-[rgba(255,255,255,0.8)] mb-12 max-w-2xl mx-auto leading-relaxed">
              4 weeks. 10 students. ₹499 to start. <span className="text-[var(--leo-sunlit)] font-bold">Zero excuses.</span>
            </p>
            
            {/* Countdown - Urgency */}
            <div className="mb-12">
              <p className="text-[var(--leo-amber)] text-sm font-bold uppercase tracking-widest mb-4">
                Next Batch Closes In
              </p>
              <LeoCountdown daysAhead={8} />
            </div>
            
            {/* CTAs - Bold and clear */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/programs" className="w-full sm:w-auto">
                <Button variant="primary" className="text-lg px-12 py-5 w-full sm:w-auto font-bold">
                  Claim Your Spot <ArrowRight size={20} className="ml-2" />
                </Button>
              </Link>
              <Button
                variant="whatsapp"
                href="https://wa.me/9063443115?text=Hi%20Leovex%2C%20I%20want%20to%20claim%20my%20spot!"
                className="text-lg px-12 py-5 w-full sm:w-auto font-bold"
              >
                <MessageCircle size={20} className="mr-2" />
                Talk to Us
              </Button>
            </div>
            
            {/* Social proof - Subtle */}
            <p className="text-sm text-[rgba(255,255,255,0.4)] mt-8">
              Join 500+ engineers who chose speed over theory
            </p>
          </div>
          
          {/* Accent lines - Premium detail */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--leo-sunlit)] to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--leo-sunlit)] to-transparent" />
        </div>
      </div>
    </section>
  )
}
