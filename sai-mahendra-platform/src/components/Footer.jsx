import { Link } from 'react-router-dom'
import { MessageCircle, Mail, ArrowUpRight, Linkedin, Twitter, Instagram, Award } from 'lucide-react'
import lion3D from '../assets/leo-lion-3d.png'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative bg-[#0D0B07] border-t border-[var(--border-gold)] overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-[rgba(201,146,42,0.05)] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[rgba(245,200,66,0.03)] rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 sm:px-8 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 mb-12">
          {/* Brand Section - Larger */}
          <div className="lg:col-span-5">
            <Link to="/" className="inline-block mb-6 group">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[var(--leo-sunlit)] opacity-30 blur-2xl rounded-full group-hover:opacity-50 transition-opacity" />
                  <img 
                    src={lion3D} 
                    alt="Leovex Lion" 
                    className="w-16 h-16 rounded-xl relative z-10 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <span className="text-3xl font-bold tracking-wider gradient-text" style={{ fontFamily: 'var(--font-display)' }}>
                  LEOVEX
                </span>
              </div>
            </Link>
            <p className="text-[var(--text-secondary)] text-base leading-relaxed mb-6 max-w-md">
              Building the next generation of <span className="text-[var(--leo-sunlit)] font-semibold">Forward Deployed Engineers</span>. Master Fullstack + AI with real projects, not theory.
            </p>
            
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border-gold)] bg-[rgba(201,146,42,0.06)]">
              <Award size={16} className="text-[var(--leo-amber)]" />
              <span className="text-xs font-semibold text-[var(--leo-amber)] tracking-wide">
                The Fastest Learning Platform
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2">
            <h4 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-wider mb-6">
              Explore
            </h4>
            <ul className="space-y-3">
              {[
                { label: 'Home', to: '/' },
                { label: 'Programs', to: '/programs' },
                { label: 'About', to: '/#about' },
                { label: 'Contact', to: '/contact' },
              ].map((link) => (
                <li key={link.to}>
                  <Link 
                    to={link.to} 
                    className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--leo-sunlit)] text-sm transition-all duration-300"
                  >
                    <span>{link.label}</span>
                    <ArrowUpRight size={14} className="opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Programs */}
          <div className="lg:col-span-2">
            <h4 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-wider mb-6">
              Programs
            </h4>
            <ul className="space-y-3">
              {[
                { label: 'Starter', price: '₹499' },
                { label: 'Membership', price: '₹999/mo' },
                { label: 'Accelerator', price: '₹2,999' },
                { label: 'Pro Developer', price: '₹4,999' },
              ].map((program) => (
                <li key={program.label}>
                  <Link 
                    to="/programs" 
                    className="group flex items-center justify-between text-[var(--text-secondary)] hover:text-[var(--leo-sunlit)] text-sm transition-colors duration-300"
                  >
                    <span>{program.label}</span>
                    <span className="text-xs text-[var(--text-muted)] group-hover:text-[var(--leo-amber)]">{program.price}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="lg:col-span-3">
            <h4 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-wider mb-6">
              Get in Touch
            </h4>
            <div className="space-y-4 mb-6">
              <a
                href="https://wa.me/9063443115?text=Hi%20Leovex%2C%20I%20want%20to%20become%20a%20Forward%20Deployed%20Engineer!"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 p-3 rounded-xl border border-[var(--border-gold)] bg-[rgba(201,146,42,0.04)] hover:bg-[rgba(201,146,42,0.08)] hover:border-[var(--border-gold-hover)] transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <MessageCircle size={18} className="text-green-400" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">WhatsApp</div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Chat with us</div>
                </div>
                <ArrowUpRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--leo-amber)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </a>

              <a
                href="mailto:saimahendra222@gmail.com"
                className="group flex items-center gap-3 p-3 rounded-xl border border-[var(--border-gold)] bg-[rgba(201,146,42,0.04)] hover:bg-[rgba(201,146,42,0.08)] hover:border-[var(--border-gold-hover)] transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--leo-gold)]/10 flex items-center justify-center group-hover:bg-[var(--leo-gold)]/20 transition-colors">
                  <Mail size={18} className="text-[var(--leo-amber)]" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Email</div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Get in touch</div>
                </div>
                <ArrowUpRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--leo-amber)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </a>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-3">
              <a 
                href="#" 
                className="w-9 h-9 rounded-lg border border-[var(--border-gold)] bg-[rgba(201,146,42,0.04)] hover:bg-[rgba(201,146,42,0.1)] hover:border-[var(--border-gold-hover)] flex items-center justify-center transition-all duration-300 group"
                aria-label="LinkedIn"
              >
                <Linkedin size={16} className="text-[var(--text-muted)] group-hover:text-[var(--leo-amber)]" />
              </a>
              <a 
                href="#" 
                className="w-9 h-9 rounded-lg border border-[var(--border-gold)] bg-[rgba(201,146,42,0.04)] hover:bg-[rgba(201,146,42,0.1)] hover:border-[var(--border-gold-hover)] flex items-center justify-center transition-all duration-300 group"
                aria-label="Twitter"
              >
                <Twitter size={16} className="text-[var(--text-muted)] group-hover:text-[var(--leo-amber)]" />
              </a>
              <a 
                href="#" 
                className="w-9 h-9 rounded-lg border border-[var(--border-gold)] bg-[rgba(201,146,42,0.04)] hover:bg-[rgba(201,146,42,0.1)] hover:border-[var(--border-gold-hover)] flex items-center justify-center transition-all duration-300 group"
                aria-label="Instagram"
              >
                <Instagram size={16} className="text-[var(--text-muted)] group-hover:text-[var(--leo-amber)]" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[var(--border-gold)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-[var(--text-muted)]">
              © {currentYear} <span className="text-[var(--leo-amber)] font-semibold">Leovex</span>. All rights reserved.
            </div>
            <div className="flex items-center gap-6 text-xs text-[var(--text-muted)]">
              <Link to="/privacy" className="hover:text-[var(--leo-amber)] transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-[var(--leo-amber)] transition-colors">
                Terms of Service
              </Link>
              <span className="flex items-center gap-1.5">
                Made with <span className="text-[var(--leo-sunlit)]">⚡</span> in India
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
