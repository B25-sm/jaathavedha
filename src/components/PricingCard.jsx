import { Check } from 'lucide-react'
import Button from './Button'
import LeoCountUp from './ui/LeoCountUp'

export default function PricingCard({ tier, price, features, cta, highlighted = false }) {
  const whatsappMsg = encodeURIComponent(`Hi Leovex, I want to enroll in the ${tier} program!`)
  const firstNumeric = Number(String(price).replace(/[^\d]/g, '').slice(0, 4) || 0)

  return (
    <div
      className={`leo-card relative rounded-2xl p-6 flex flex-col gap-5 ${
        highlighted
          ? 'leo-card-featured'
          : ''
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="leo-featured-badge px-4 py-1 rounded-full text-xs font-bold bg-[var(--gradient-gold)] text-[#0D0B07] shadow-lg">
            PRIDE PICK
          </span>
        </div>
      )}

      <div>
        <h3 className="text-xl font-semibold text-[var(--leo-amber)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>{tier}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold gradient-text" style={{ fontFamily: 'var(--font-display)' }}>
            {firstNumeric > 0 ? <LeoCountUp end={firstNumeric} prefix="₹" /> : price}
            {price.includes('–') ? ' +' : ''}
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-3 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
            <Check size={16} className="text-[var(--leo-amber)] mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <Button
        href={`https://wa.me/9063443115?text=${whatsappMsg}`}
        variant={highlighted ? 'primary' : 'secondary'}
        className="w-full"
      >
        {cta}
      </Button>
    </div>
  )
}
