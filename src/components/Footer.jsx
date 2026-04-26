import { Link } from 'react-router-dom'
import { MessageCircle, Mail } from 'lucide-react'
import LeoMark from './leo/LeoMark'

export default function Footer() {
  return (
    <footer className="bg-[#0D0B07] border-t border-[var(--border-gold)] py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <LeoMark withText className="w-8 h-8" />
            </div>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
              Fullstack + AI training that focuses on real projects and practical skills.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-[var(--text-primary)] font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { label: 'Home', to: '/' },
                { label: 'Programs', to: '/programs' },
                { label: 'Contact', to: '/contact' },
              ].map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-[var(--text-secondary)] hover:text-[var(--leo-amber)] text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[var(--text-primary)] font-semibold mb-3">Get in Touch</h4>
            <div className="space-y-2">
              <a
                href="https://wa.me/9063443115"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-green-400 text-sm transition-colors"
              >
                <MessageCircle size={16} />
                WhatsApp
              </a>
              <a
                href="mailto:saimahendra222@gmail.com"
                className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--leo-amber)] text-sm transition-colors"
              >
                <Mail size={16} />
                saimahendra222@gmail.com
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border-gold)] pt-6 text-center text-[var(--text-muted)] text-sm">
          © {new Date().getFullYear()} Leovex. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
