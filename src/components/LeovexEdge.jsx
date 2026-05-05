import { Zap, Users, Trophy, Clock, BadgeCheck, CalendarClock } from 'lucide-react'
import SectionHeading from './SectionHeading'
import { LeoBadgeCrown } from './ui/LeoBadge'

const edges = [
  {
    icon: Zap,
    stat: '4 Weeks',
    title: 'Job-Ready in 4 Weeks Flat',
    desc: 'While other courses drag you through 7–8 months of bloated content, Leovex compresses the entire journey into a razor-sharp 4-week sprint. Every single day is engineered for maximum output — zero filler, zero fluff.',
    highlight: true,
    color: 'text-[var(--leo-sunlit)]',
    bg: 'bg-[rgba(245,200,66,0.12)]',
  },
  {
    icon: Zap,
    stat: '100x Speed',
    title: 'Learn at 100x the Industry Speed',
    desc: 'We cut every ounce of clutter that slows students down. No recycled slides, no irrelevant theory. Just the exact skills, in the exact order, that turn beginners into builders — at a pace no other platform dares to match.',
    highlight: false,
    color: 'text-[var(--leo-amber)]',
    bg: 'bg-[rgba(201,146,42,0.12)]',
  },
  {
    icon: Users,
    stat: 'Max 10',
    title: "World's Smallest Batch Size",
    desc: "Forget being student #67 in a 100-person batch where your doubts go unanswered. At Leovex, every batch is capped at just 10 students — giving you direct, personal access to your trainer every single session. This is the smallest batch size in the entire industry.",
    highlight: false,
    color: 'text-[var(--leo-amber)]',
    bg: 'bg-[rgba(201,146,42,0.12)]',
  },
  {
    icon: Trophy,
    stat: 'Top 2',
    title: 'Placement Assistance for Top Performers',
    desc: 'The top 2 performers in every batch get direct placement assistance — resume reviews, referrals, and interview prep support. Compete, excel, and let Leovex open the door to your first or next big role.',
    highlight: false,
    color: 'text-[var(--leo-amber)]',
    bg: 'bg-[rgba(201,146,42,0.12)]',
  },
  {
    icon: BadgeCheck,
    stat: 'Certified',
    title: 'Industry-Recognised Certificate',
    desc: 'Every student who completes the program walks away with a Leovex certificate — a proof of real, project-backed skills that stands out in any portfolio or LinkedIn profile.',
    highlight: false,
    color: 'text-[var(--leo-amber)]',
    bg: 'bg-[rgba(201,146,42,0.12)]',
  },
  {
    icon: CalendarClock,
    stat: '+1–2 Months',
    title: 'Extension Available — On Your Terms',
    desc: "Want to go deeper? Students who need more time can extend their learning by 1–2 months. No pressure, no penalty — just continued mentorship until you're truly confident and ready.",
    highlight: false,
    color: 'text-[var(--leo-amber)]',
    bg: 'bg-[rgba(201,146,42,0.12)]',
  },
]

export default function LeovexEdge() {
  return (
    <section id="leovex-edge" className="py-24 px-4 leo-section-dark">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4">
          <LeoBadgeCrown>The Leovex Advantage</LeoBadgeCrown>
        </div>
        <SectionHeading
          tag=""
          title="Why Leovex is in a League of Its Own"
          subtitle="This isn't just another course. This is the fastest, most personal, most affordable path from zero to job-ready — and nothing else comes close."
        />

        {/* Big hero stat row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-14">
          {edges.map(({ stat, title }) => (
            <div key={title} className="leo-card rounded-2xl p-4 text-center card-hover">
              <div className="text-2xl font-bold gradient-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>{stat}</div>
              <div className="text-[var(--text-muted)] text-xs leading-snug">{title.split(' ').slice(0, 3).join(' ')}</div>
            </div>
          ))}
        </div>

        {/* Detail cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {edges.map(({ icon: Icon, stat, title, desc, highlight, color, bg }) => (
            <div
              key={title}
              className={`leo-card rounded-2xl p-6 card-hover flex flex-col gap-4 ${highlight ? 'leo-card-featured' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={22} className={color} />
                </div>
                <span className="text-2xl font-bold gradient-text" style={{ fontFamily: 'var(--font-display)' }}>{stat}</span>
              </div>
              <h3 className="text-[var(--text-primary)] font-bold text-base leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
                {title}
              </h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Bottom comparison callout */}
        <div className="mt-14 leo-card rounded-2xl p-6 sm:p-8 border border-[var(--border-gold)]">
          <div className="grid sm:grid-cols-2 gap-6 items-center">
            <div>
              <p className="text-[var(--leo-amber)] text-xs uppercase tracking-widest mb-3 font-semibold">The Honest Comparison</p>
              <h3 className="text-[var(--text-primary)] text-xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                Others charge more. Teach slower. Ignore you in a crowd.
              </h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                Traditional edtechs pack 50–100 students into a single batch, charge a premium, and leave you lost in the noise. At Leovex, you pay less, learn faster, and get the personal attention that actually moves the needle.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Time to job-ready', them: '7–8 months', us: '4 Weeks' },
                { label: 'Batch size', them: '50–100 students', us: 'Max 10 students' },
                { label: 'Trainer attention', them: 'Minimal', us: '1-on-1 every session' },
                { label: 'Cost', them: 'Premium pricing', us: 'Starts at ₹499' },
                { label: 'Certificate', them: 'Sometimes', us: 'Always included' },
                { label: 'Placement support', them: 'Rarely', us: 'Top 2 per batch' },
              ].map(({ label, them, us }) => (
                <div key={label} className="grid grid-cols-3 gap-2 text-xs items-center">
                  <span className="text-[var(--text-muted)]">{label}</span>
                  <span className="text-center px-2 py-1 rounded-lg bg-[rgba(255,80,80,0.08)] text-red-400 line-through">{them}</span>
                  <span className="text-center px-2 py-1 rounded-lg bg-[rgba(201,146,42,0.15)] text-[var(--leo-sunlit)] font-semibold">{us}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
