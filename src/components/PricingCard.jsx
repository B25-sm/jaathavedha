import { Check } from 'lucide-react'
import Button from './Button'

export default function PricingCard({ tier, price, features, cta, highlighted = false }) {
  const whatsappMsg = encodeURIComponent(`Hi Leovex, I want to enroll in the ${tier} program!`)

  return (
    <div
      className={`relative rounded-2xl p-6 flex flex-col gap-5 card-hover ${
        highlighted
          ? 'bg-gradient-to-b from-violet-900/60 to-gray-900 border-2 border-violet-500 shadow-xl shadow-violet-500/20'
          : 'bg-gray-900 border border-gray-800'
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg">
            Most Popular
          </span>
        </div>
      )}

      <div>
        <h3 className="text-xl font-bold text-white mb-1">{tier}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold gradient-text">{price}</span>
        </div>
      </div>

      <ul className="flex flex-col gap-3 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
            <Check size={16} className="text-violet-400 mt-0.5 shrink-0" />
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
