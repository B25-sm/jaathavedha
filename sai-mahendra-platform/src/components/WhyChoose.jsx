import SectionHeading from './SectionHeading'
import { CrownIcon, PawIcon } from './leo/LeoIcons'

const reasons = [
  {
    icon: PawIcon,
    title: 'Job-Ready in Just 4 Weeks',
    desc: 'Other platforms take 7–8 months. We deliver the same outcome in 4 weeks — because we cut every ounce of clutter and teach only what matters.',
    color: 'text-[var(--leo-amber)]',
    bg: 'bg-[rgba(201,146,42,0.12)]',
  },
  {
    icon: CrownIcon,
    title: "World's Smallest Batch — Max 10",
    desc: 'No more getting lost in a crowd of 50–100 students. Every Leovex batch has a maximum of 10 students — so every doubt gets answered, every session.',
    color: 'text-[var(--leo-sunlit)]',
    bg: 'bg-[rgba(245,200,66,0.12)]',
  },
  {
    icon: PawIcon,
    title: 'Costs Less. Delivers More.',
    desc: 'Premium edtechs charge a fortune and still leave you confused. Leovex starts at ₹499 — and gives you more real-world skill than courses 10x the price.',
    color: 'text-[var(--leo-gold)]',
    bg: 'bg-[rgba(155,110,26,0.2)]',
  },
  {
    icon: CrownIcon,
    title: 'Placement for Top 2 Performers',
    desc: 'The top 2 students in every batch get direct placement assistance. Compete, excel, and let Leovex open the door to your first big role.',
    color: 'text-[var(--leo-amber)]',
    bg: 'bg-[rgba(122,79,16,0.2)]',
  },
]

export default function WhyChoose() {
  return (
    <section id="why" className="py-24 px-4 leo-section-dark">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="Why This Program"
          title="The Unfair Advantage You Deserve"
          subtitle="4 weeks. Max 10 students. Starts at ₹499. Certificate included. Placement support for top performers. Nothing else comes close."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {reasons.map(({ icon: Icon, title, desc, color, bg }) => (
            <div
              key={title}
              className="leo-card rounded-2xl p-6 card-hover"
            >
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                <Icon size={22} className={color} />
              </div>
              <h3 className="text-[var(--text-primary)] font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>{title}</h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
