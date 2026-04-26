import { ArrowRight, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from './Button'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 pt-16 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-cyan-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          Fullstack + AI Training — Practical & Affordable
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight mb-6">
          Learn Fullstack + AI{' '}
          <span className="gradient-text">with Clarity</span>
          <br />
          and Real Projects
        </h1>

        {/* Subtext */}
        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Skip months of confusion. Learn what actually matters — from React to AI Agents — with structured programs starting at just{' '}
          <span className="text-white font-semibold">₹499</span>.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">2+</span>
            <span>Years Training</span>
          </div>
          <div className="w-px h-6 bg-gray-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">₹499</span>
            <span>Starting Price</span>
          </div>
          <div className="w-px h-6 bg-gray-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">3</span>
            <span>Program Tiers</span>
          </div>
          <div className="w-px h-6 bg-gray-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">100%</span>
            <span>Project-Based</span>
          </div>
        </div>
      </div>
    </section>
  )
}
