import { Link } from 'react-router-dom'
import { Zap, MessageCircle, Mail } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                <Zap size={16} className="text-white" />
              </div>
              <span className="font-bold text-lg text-white">
                Leo<span className="text-violet-400">vex</span>
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Fullstack + AI training that focuses on real projects and practical skills.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { label: 'Home', to: '/' },
                { label: 'Programs', to: '/programs' },
                { label: 'Contact', to: '/contact' },
              ].map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-gray-400 hover:text-violet-400 text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-3">Get in Touch</h4>
            <div className="space-y-2">
              <a
                href="https://wa.me/9063443115"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-400 hover:text-green-400 text-sm transition-colors"
              >
                <MessageCircle size={16} />
                WhatsApp
              </a>
              <a
                href="mailto:saimahendra222@gmail.com"
                className="flex items-center gap-2 text-gray-400 hover:text-violet-400 text-sm transition-colors"
              >
                <Mail size={16} />
                saimahendra222@gmail.com
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} Leovex. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
