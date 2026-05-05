import { ArrowRight, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from './Button'
import LeoParticles from './leo/LeoParticles'
import LeoCountdown from './ui/LeoCountdown'

export default function FinalCTA() {
  return (
    <section className="py-24 px-4 leo-section-card relative overflow-hidden">
      <LeoParticles count={20} />
      <div className="max-w-3xl mx-auto text-center">
        {/* Glow */}
        <div className="relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,146,42,0.22),transparent_65%)] rounded-3xl blur-2xl" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-3xl p-10 sm:p-14">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[rgba(201,146,42,0.15)] text-[var(--leo-amber)] border border-[var(--border-gold)] mb-6">
              Ready to Start?
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--leo-sunlit)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Start your journey now
            </h2>
            <p className="text-[var(--text-secondary)] text-lg mb-8 leading-relaxed">
              Job-ready in <span className="text-[var(--leo-sunlit)] font-semibold">4 weeks</span>. Batches of <span className="text-[var(--leo-sunlit)] font-semibold">max 10 students</span>. Certificate included. Placement assistance for top 2 performers. Starting at just <span className="text-[var(--leo-sunlit)] font-semibold">₹499</span>. What more could you ask for?
            </p>
            <div className="mb-8">
              <p className="text-[var(--leo-amber)] text-sm uppercase tracking-[0.09em] mb-3">
                Next batch fills in
              </p>
              <LeoCountdown daysAhead={8} />
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/programs">
                <Button variant="primary" className="text-base px-8 py-4">
                  Enroll Now <ArrowRight size={18} />
                </Button>
              </Link>
              <Button
                variant="whatsapp"
                href="https://wa.me/9063443115?text=Hi%20Leovex%2C%20I%20want%20to%20enroll!"
                className="text-base px-8 py-4"
              >
                <MessageCircle size={18} />
                Contact on WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
