import { ArrowRight, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from './Button'

export default function FinalCTA() {
  return (
    <section className="py-24 px-4 bg-gray-950/50">
      <div className="max-w-3xl mx-auto text-center">
        {/* Glow */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 rounded-3xl blur-2xl" />
          <div className="relative bg-gray-900 border border-gray-800 rounded-3xl p-10 sm:p-14">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-6">
              Ready to Start?
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Start your journey now
            </h2>
            <p className="text-gray-400 text-lg mb-8 leading-relaxed">
              Pick a program, reach out on WhatsApp, and start building real skills today. No long commitments, no confusion.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/programs">
                <Button variant="primary" className="text-base px-8 py-4">
                  Enroll Now <ArrowRight size={18} />
                </Button>
              </Link>
              <Button
                variant="whatsapp"
                href="https://wa.me/9063443115?text=Hi%20Sai%2C%20I%20want%20to%20enroll!"
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
