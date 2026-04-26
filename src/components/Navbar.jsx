import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import lion3D from '../assets/leo-lion-3d.png'

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Programs', to: '/programs' },
  { label: 'Contact', to: '/contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOpen(false), [location])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#0D0B07]/95 backdrop-blur-md shadow-lg shadow-black/20 border-b border-[var(--border-gold)]' : 'bg-transparent'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <img
            src={lion3D}
            alt="Leovex lion logo"
            className="w-9 h-9 rounded-lg object-cover border border-[var(--border-gold)] shadow-[0_0_10px_rgba(245,200,66,0.3)]"
          />
          <span className="text-[1.05rem] font-semibold tracking-[0.14em] gradient-text" style={{ fontFamily: 'var(--font-display)' }}>
            LEOVEX
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? 'text-[var(--leo-amber)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://wa.me/9063443115?text=Hi%20Leovex%2C%20I%20want%20to%20enroll!"
            target="_blank"
            rel="noopener noreferrer"
            className="leo-btn-primary px-4 py-2 rounded-lg text-sm"
          >
            Enroll Now
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#0D0B07]/98 backdrop-blur-md border-t border-[var(--border-gold)] px-4 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm font-medium py-2 transition-colors ${
                location.pathname === link.to ? 'text-[var(--leo-amber)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://wa.me/9063443115?text=Hi%20Leovex%2C%20I%20want%20to%20enroll!"
            target="_blank"
            rel="noopener noreferrer"
            className="leo-btn-primary px-4 py-3 rounded-lg text-sm text-center"
          >
            Enroll Now
          </a>
        </div>
      )}
    </header>
  )
}
