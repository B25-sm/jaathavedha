import { Target, Zap, Users, Trophy, BadgeCheck, TrendingUp, Clock, Sparkles } from 'lucide-react'
import SectionHeading from '../SectionHeading'
import { LeoBadgeCrown } from '../ui/LeoBadge'

const whyUsReasons = [
  {
    icon: Clock,
    title: '4 Weeks to Job-Ready',
    description: 'While others waste 7-8 months, we get you industry-ready in just 4 weeks. No fluff, no filler—just pure, focused learning that delivers results.',
    stat: '4 Weeks',
    color: 'text-[var(--leo-sunlit)]',
    bg: 'bg-[rgba(245,200,66,0.12)]',
  },
  {
    icon: Users,
    title: 'Ultra-Small Batches',
    description: 'Maximum 10 students per batch. No getting lost in a crowd of 50-100. Every question answered, every doubt cleared, every session personalized.',
    stat: 'Max 10',
    color: 'text-[var(--leo-amber)]',
    bg: 'bg-[rgba(201,146,42,0.12)]',
  },
  {
    icon: TrendingUp,
    title: 'Unbeatable Value',
    description: 'Premium quality at ₹499. Get more real-world skills than courses charging 10x the price. Quality education shouldn\'t break the bank.',
    stat: '₹499',
    color: 'text-[var(--leo-gold)]',
    bg: 'bg-[rgba(155,110,26,0.2)]',
  },
  {
    icon: Trophy,
    title: 'Guaranteed Placement Support',
    description: 'Top 2 performers in every batch get direct placement assistance—resume reviews, referrals, and interview prep. Your success is our mission.',
    stat: 'Top 2',
    color: 'text-[var(--leo-amber)]',
    bg: 'bg-[rgba(122,79,16,0.2)]',
  },
  {
    icon: Target,
    title: 'Industry-Focused Curriculum',
    description: 'Learn exactly what companies are hiring for. Real projects, real tools, real skills. No outdated theory or irrelevant content.',
    stat: '100%',
    color: 'text-[var(--leo-sunlit)]',
    bg: 'bg-[rgba(245,200,66,0.12)]',
  },
  {
    icon: BadgeCheck,
    title: 'Recognized Certification',
    description: 'Every graduate receives an industry-recognized certificate. Showcase your skills with confidence on LinkedIn and your portfolio.',
    stat: 'Certified',
    color: 'text-[var(--leo-amber)]',
    bg: 'bg-[rgba(201,146,42,0.12)]',
  },
  {
    icon: Zap,
    title: '100x Faster Learning',
    description: 'Our accelerated methodology cuts through the noise. Learn at 100x the industry speed without compromising on quality or depth.',
    stat: '100x',
    color: 'text-[var(--leo-gold)]',
    bg: 'bg-[rgba(155,110,26,0.2)]',
  },
  {
    icon: Sparkles,
    title: 'Flexible Extensions',
    description: 'Need more time? Extend your learning by 1-2 months at no extra pressure. We support your journey until you\'re truly confident.',
    stat: '+1-2 Mo',
    color: 'text-[var(--leo-amber)]',
    bg: 'bg-[rgba(122,79,16,0.2)]',
  },
]

const comparisonData = [
  { feature: 'Time to Job-Ready', others: '7-8 months', leovex: '4 Weeks' },
  { feature: 'Batch Size', others: '50-100 students', leovex: 'Max 10 students' },
  { feature: 'Personal Attention', others: 'Minimal', leovex: '1-on-1 Every Session' },
  { feature: 'Starting Price', others: '₹50,000+', leovex: '₹499' },
  { feature: 'Certificate', others: 'Sometimes', leovex: 'Always Included' },
  { feature: 'Placement Support', others: 'Rarely', leovex: 'Top 2 Per Batch' },
  { feature: 'Learning Speed', others: 'Standard', leovex: '100x Faster' },
  { feature: 'Extension Options', others: 'Fixed Duration', leovex: 'Flexible +1-2 Months' },
]

export default function WhyUs() {
  return (
    <section id="why-us" className="py-24 px-4 leo-section-dark">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <LeoBadgeCrown>Why Choose Leovex</LeoBadgeCrown>
        </div>
        <SectionHeading
          tag="The Leovex Difference"
          title="Why Students Choose Us Over Everyone Else"
          subtitle="We're not just another online course. We're a complete transformation system designed to get you job-ready faster, better, and more affordably than anyone else in the industry."
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mb-16">
          {whyUsReasons.map(({ stat, title }) => (
            <div key={title} className="leo-card rounded-xl p-4 text-center card-hover">
              <div className="text-2xl font-bold gradient-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                {stat}
              </div>
              <div className="text-[var(--text-muted)] text-xs leading-tight">
                {title.split(' ').slice(0, 2).join(' ')}
              </div>
            </div>
          ))}
        </div>

        {/* Main Reasons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {whyUsReasons.map(({ icon: Icon, title, description, color, bg }) => (
            <div
              key={title}
              className="leo-card rounded-2xl p-6 card-hover flex flex-col gap-4"
            >
              <div className={`w-14 h-14 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={24} className={color} />
              </div>
              <h3 className="text-[var(--text-primary)] font-bold text-lg leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
                {title}
              </h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="leo-card rounded-2xl p-8 border border-[var(--border-gold)]">
          <div className="text-center mb-8">
            <p className="text-[var(--leo-amber)] text-xs uppercase tracking-widest mb-3 font-semibold">
              The Honest Comparison
            </p>
            <h3 className="text-[var(--text-primary)] text-2xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              Leovex vs. Traditional Platforms
            </h3>
            <p className="text-[var(--text-secondary)] text-sm max-w-2xl mx-auto">
              See exactly why thousands of students are choosing Leovex over expensive, slow, and impersonal alternatives.
            </p>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="text-left py-4 px-4 text-[var(--text-muted)] text-sm font-semibold">Feature</th>
                  <th className="text-center py-4 px-4 text-[var(--text-muted)] text-sm font-semibold">Other Platforms</th>
                  <th className="text-center py-4 px-4 text-[var(--leo-sunlit)] text-sm font-semibold">Leovex</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map(({ feature, others, leovex }) => (
                  <tr key={feature} className="border-b border-[var(--border-subtle)] hover:bg-[rgba(201,146,42,0.05)] transition-colors">
                    <td className="py-4 px-4 text-[var(--text-primary)] text-sm font-medium">{feature}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-block px-3 py-1 rounded-lg bg-[rgba(255,80,80,0.08)] text-red-400 text-sm line-through">
                        {others}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-block px-3 py-1 rounded-lg bg-[rgba(201,146,42,0.15)] text-[var(--leo-sunlit)] text-sm font-semibold">
                        {leovex}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {comparisonData.map(({ feature, others, leovex }) => (
              <div key={feature} className="bg-[rgba(201,146,42,0.05)] rounded-xl p-4">
                <div className="text-[var(--text-primary)] font-semibold mb-3 text-sm">{feature}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[var(--text-muted)] text-xs mb-1">Others</div>
                    <div className="px-2 py-1 rounded-lg bg-[rgba(255,80,80,0.08)] text-red-400 text-xs line-through">
                      {others}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)] text-xs mb-1">Leovex</div>
                    <div className="px-2 py-1 rounded-lg bg-[rgba(201,146,42,0.15)] text-[var(--leo-sunlit)] text-xs font-semibold">
                      {leovex}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-8 text-center">
            <p className="text-[var(--text-secondary)] text-sm mb-4">
              The choice is clear. Join thousands of students who chose quality, speed, and personal attention.
            </p>
            <a
              href="#programs"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--leo-gold)] to-[var(--leo-amber)] text-[var(--bg-dark)] font-semibold text-sm hover:shadow-lg hover:shadow-[rgba(201,146,42,0.3)] transition-all duration-300"
            >
              <Sparkles size={18} />
              Explore Our Programs
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
