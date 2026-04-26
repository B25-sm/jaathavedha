import { useState } from 'react'
import { MessageCircle, Mail, Send, CheckCircle } from 'lucide-react'
import SectionHeading from '../components/SectionHeading'
import Button from '../components/Button'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email is required'
    if (!form.message.trim()) e.message = 'Message is required'
    return e
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: '' })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    // Build WhatsApp message as fallback / primary action
    const msg = encodeURIComponent(
      `Hi Leovex!\nName: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone}\nMessage: ${form.message}`
    )
    window.open(`https://wa.me/9063443115?text=${msg}`, '_blank')
    setSubmitted(true)
  }

  return (
    <div className="pt-24 pb-16 px-4 min-h-screen leo-page">
      <div className="max-w-5xl mx-auto">
        <SectionHeading
          tag="Contact"
          title="Get in Touch"
          subtitle="Have questions about a program? Reach out and Leovex will get back to you quickly."
        />

        <div className="grid md:grid-cols-2 gap-10">
          {/* Left: form */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl p-6 sm:p-8">
            {submitted ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <CheckCircle size={48} className="text-[#27AE60] mb-4" />
                <h3 className="text-[var(--text-primary)] text-xl font-bold mb-2">Message Sent!</h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  Your message was sent via WhatsApp. Leovex will respond shortly.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: '', email: '', phone: '', message: '' }) }}
                  className="mt-6 text-[var(--leo-amber)] text-sm hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                <h3 className="text-[var(--text-primary)] font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>Send a Message</h3>

                {/* Name */}
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1.5" htmlFor="name">
                    Full Name <span className="text-[var(--leo-amber)]">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your name"
                    className={`w-full bg-[var(--bg-hover)] border rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--leo-gold)] transition ${
                      errors.name ? 'border-[#C0392B]' : 'border-[var(--border-gold)]'
                    }`}
                  />
                  {errors.name && <p className="text-[#C0392B] text-xs mt-1">{errors.name}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1.5" htmlFor="email">
                    Email Address <span className="text-[var(--leo-amber)]">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className={`w-full bg-[var(--bg-hover)] border rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--leo-gold)] transition ${
                      errors.email ? 'border-[#C0392B]' : 'border-[var(--border-gold)]'
                    }`}
                  />
                  {errors.email && <p className="text-[#C0392B] text-xs mt-1">{errors.email}</p>}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1.5" htmlFor="phone">
                    Phone Number <span className="text-[var(--text-muted)] text-xs">(optional)</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+91 9999999999"
                    className="w-full bg-[var(--bg-hover)] border border-[var(--border-gold)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--leo-gold)] transition"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1.5" htmlFor="message">
                    Message <span className="text-[var(--leo-amber)]">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Tell Leovex what you're looking for..."
                    className={`w-full bg-[var(--bg-hover)] border rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--leo-gold)] transition resize-none ${
                      errors.message ? 'border-[#C0392B]' : 'border-[var(--border-gold)]'
                    }`}
                  />
                  {errors.message && <p className="text-[#C0392B] text-xs mt-1">{errors.message}</p>}
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl leo-btn-primary text-sm hover:opacity-90 transition-opacity"
                >
                  <Send size={16} />
                  Send via WhatsApp
                </button>
              </form>
            )}
          </div>

          {/* Right: contact info */}
          <div className="flex flex-col gap-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl p-6">
              <h3 className="text-[var(--text-primary)] font-bold text-lg mb-5">Direct Contact</h3>
              <div className="flex flex-col gap-4">
                <a
                  href="https://wa.me/9063443115"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 hover:border-green-500/50 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <MessageCircle size={20} className="text-green-400" />
                  </div>
                  <div>
                    <div className="text-[var(--text-primary)] font-semibold text-sm">WhatsApp</div>
                    <div className="text-[var(--text-secondary)] text-xs">+91 9063443115 · Fastest response</div>
                  </div>
                </a>

                <a
                  href="mailto:saimahendra222@gmail.com"
                  className="flex items-center gap-4 p-4 rounded-xl bg-[rgba(201,146,42,0.12)] border border-[var(--border-gold)] hover:border-[var(--border-gold-hover)] transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[rgba(201,146,42,0.2)] flex items-center justify-center">
                    <Mail size={20} className="text-[var(--leo-amber)]" />
                  </div>
                  <div>
                    <div className="text-[var(--text-primary)] font-semibold text-sm">Email</div>
                    <div className="text-[var(--text-secondary)] text-xs">saimahendra222@gmail.com</div>
                  </div>
                </a>
              </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl p-6">
              <h3 className="text-[var(--text-primary)] font-bold mb-3">Quick Enroll</h3>
              <p className="text-[var(--text-secondary)] text-sm mb-5 leading-relaxed">
                Know which program you want? Skip the form and enroll directly via WhatsApp.
              </p>
              <Button
                href="https://wa.me/9063443115?text=Hi%20Leovex%2C%20I%20want%20to%20enroll!"
                variant="whatsapp"
                className="w-full"
              >
                <MessageCircle size={16} />
                Enroll on WhatsApp
              </Button>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl p-6">
              <h3 className="text-[var(--text-primary)] font-bold mb-2">Response Time</h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                WhatsApp messages are typically answered within a few hours. Email responses within 24 hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
