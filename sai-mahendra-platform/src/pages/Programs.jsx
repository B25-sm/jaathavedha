import { Check, ArrowRight, MessageCircle } from 'lucide-react'
import Button from '../components/Button'
import SectionHeading from '../components/SectionHeading'

const programs = [
  {
    tier: 'Leovex Starter',
    price: '\u20b9499',
    tagline: 'Your first step into the Leovex ecosystem',
    purpose: 'Entry & clarity unlock',
    promise: 'Understand the path and build your first guided real-world sprint.',
    color: 'border-[var(--border-gold)]',
    glow: 'from-[rgba(201,146,42,0.1)]',
    features: [
      { label: 'Guided Live Session', desc: 'One focused sprint with your trainer — no fluff, just direction.' },
      { label: 'Complete Mini-Project', desc: 'Build your first real app from scratch and own it.' },
      { label: 'Fullstack Clarity Session', desc: 'Pick your track — MERN, Python, or Java — with expert guidance.' },
      { label: 'AI Fundamentals for Developers', desc: 'Understand how AI fits into modern development.' },
      { label: 'Personalised Learning Roadmap', desc: 'A clear, step-by-step path built around your goals.' },
      { label: 'Limited Community Access', desc: 'Join the Leovex learner community and start connecting.' },
    ],
    outcomes: ['Clarity on your learning path', 'First real project built', 'AI fundamentals understood'],
    whatsapp: 'Hi Leovex, I want to enroll in the Starter program!',
  },
  {
    tier: 'Leovex Membership',
    price: '\u20b9999/month',
    tagline: 'Stay consistent. Keep building. Never stagnate.',
    purpose: 'Recurring learning engine',
    promise: 'Stay consistent, keep building, and escape tutorial hell for good.',
    color: 'border-[var(--leo-gold)]',
    glow: 'from-[rgba(245,200,66,0.15)]',
    highlighted: true,
    features: [
      { label: 'Weekly Live Build Sessions', desc: 'Show up every week and build something real with your cohort.' },
      { label: 'Monthly Project Sprints', desc: 'End every month with a shipped project — not just notes.' },
      { label: 'AI Tools, Chatbots & Agent Demos', desc: 'Stay ahead with live demos of the latest AI tools and workflows.' },
      { label: 'Dedicated Doubt-Solving Sessions', desc: 'No question goes unanswered. Every doubt gets resolved.' },
      { label: 'Full Community Access + New Learning Drops', desc: 'Fresh content, resources, and peer support every month.' },
      { label: 'Monthly Build-and-Ship Challenges', desc: 'Compete, build, and ship — the fastest way to grow.' },
      { label: 'Dashboard-Based Progress Tracking', desc: 'See your growth, streaks, and scores in real time.' },
    ],
    outcomes: ['Consistent weekly progress', 'Multiple shipped projects', 'AI-integrated skill set'],
    whatsapp: 'Hi Leovex, I want to join the Membership!',
  },
  {
    tier: 'Leovex Accelerator',
    price: '\u20b92,999',
    tagline: 'Turn from a learner into a builder with real portfolio output.',
    purpose: 'Core transformation program',
    promise: 'Build a real portfolio, master your stack, and become interview-aware.',
    color: 'border-[var(--border-gold)]',
    glow: 'from-[rgba(155,110,26,0.2)]',
    features: [
      { label: 'Choose Your Stack', desc: 'MERN Stack, Python Fullstack, or Java Fullstack — you decide.' },
      { label: 'Real-World Project Building', desc: 'Build production-grade apps that solve real problems.' },
      { label: 'API Integration', desc: 'Connect your apps to real-world APIs and external services.' },
      { label: 'Debugging Workflows', desc: 'Learn to read errors, trace bugs, and fix them like a pro.' },
      { label: 'AI Integration into Your Stack', desc: 'Add AI capabilities directly into your chosen stack.' },
      { label: 'Portfolio Guidance', desc: 'Structure your projects so they impress recruiters.' },
      { label: 'Resume Structure Guidance', desc: 'Build a resume that gets you shortlisted.' },
      { label: 'Interview Prep Basics', desc: 'Know what to expect and how to answer confidently.' },
      { label: 'Small-Batch Learning (Max 10)', desc: 'Personal attention in every session — no getting lost in a crowd.' },
    ],
    outcomes: ['Job-ready portfolio', 'Full-stack project shipped', 'Interview-aware mindset'],
    whatsapp: 'Hi Leovex, I want to enroll in the Accelerator!',
  },
  {
    tier: 'Leovex Pro Developer',
    price: '\u20b94,999',
    tagline: 'Build serious Fullstack + AI capability. Become interview-ready.',
    purpose: 'Premium outcome program',
    promise: 'Everything in Accelerator — plus advanced AI systems, capstone project, and placement assistance for top performers.',
    color: 'border-[var(--leo-gold)]',
    glow: 'from-[rgba(245,200,66,0.12)]',
    features: [
      { label: 'Everything in Accelerator', desc: 'Full stack, projects, portfolio, resume, interview prep.' },
      { label: 'Advanced AI Agents', desc: 'Build multi-step reasoning agents that act autonomously.' },
      { label: 'AI Chatbots', desc: 'Design and deploy intelligent conversational systems.' },
      { label: 'Workflow Automation with n8n', desc: 'Automate complex workflows without writing boilerplate.' },
      { label: 'LangChain & LangGraph', desc: 'Build production-grade AI pipelines and agent graphs.' },
      { label: 'One Major Capstone Project', desc: 'A flagship project that defines your portfolio.' },
      { label: 'Code Review & Mentor Feedback', desc: 'Line-by-line feedback from an experienced trainer.' },
      { label: 'Resume Polishing + Portfolio Refinement', desc: 'Make every word and project count.' },
      { label: 'Mock Interview Session', desc: 'Simulate real interviews and get actionable feedback.' },
      { label: 'Priority Support + Premium Small-Batch Mentoring', desc: 'Direct access, fast responses, personal guidance.' },
      { label: 'Placement Assistance for Top 2 Performers', desc: 'The top 2 in your batch unlock career support, referrals, and advanced mock interviews.' },
    ],
    outcomes: ['Advanced AI + Fullstack mastery', 'Capstone project in portfolio', 'Placement assistance (Top 2 per batch)'],
    whatsapp: 'Hi Leovex, I want to enroll in the Pro Developer Track!',
  },
]

export default function Programs() {
  return (
    <div className="pt-24 pb-16 px-4 min-h-screen leo-page">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="All Programs"
          title="The Leovex Value Ladder"
          subtitle="Four precisely engineered tiers — from your first line of code to advanced AI + Fullstack mastery. Every step is built for real outcomes."
        />

        <div className="flex flex-col gap-10">
          {programs.map(({ tier, price, tagline, purpose, promise, color, glow, highlighted, features, outcomes, whatsapp }) => (
            <div
              key={tier}
              className={`relative rounded-2xl bg-gradient-to-br ${glow} to-[var(--bg-card)] border ${color} p-6 sm:p-8 ${
                highlighted ? 'shadow-[0_0_30px_rgba(201,146,42,0.22)]' : ''
              }`}
            >
              {highlighted && (
                <div className="absolute -top-3 left-6">
                  <span className="px-4 py-1 rounded-full text-xs font-bold bg-[var(--gradient-gold)] text-[#0D0B07] shadow-lg leo-featured-badge">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-8">
                {/* Header */}
                <div className="md:col-span-1">
                  <div className="text-[var(--leo-amber)] text-xs uppercase tracking-widest font-semibold mb-1">{purpose}</div>
                  <h2 className="text-2xl font-bold text-[var(--leo-sunlit)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>{tier}</h2>
                  <div className="text-3xl font-bold gradient-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>{price}</div>
                  <p className="text-[var(--text-secondary)] text-sm mb-3 italic">{tagline}</p>
                  <p className="text-[var(--text-muted)] text-xs leading-relaxed mb-6 border-l-2 border-[var(--border-gold)] pl-3">{promise}</p>

                  <div className="mb-6">
                    <h4 className="text-[var(--text-primary)] font-semibold text-sm mb-3">What you will achieve:</h4>
                    <ul className="space-y-2">
                      {outcomes.map((o) => (
                        <li key={o} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                          <ArrowRight size={14} className="text-[var(--leo-amber)] shrink-0" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button
                      href={`https://wa.me/9063443115?text=${encodeURIComponent(whatsapp)}`}
                      variant={highlighted ? 'primary' : 'secondary'}
                      className="w-full"
                    >
                      Enroll Now
                    </Button>
                    <Button
                      href={`https://wa.me/9063443115?text=${encodeURIComponent(whatsapp)}`}
                      variant="whatsapp"
                      className="w-full"
                    >
                      <MessageCircle size={16} />
                      Ask on WhatsApp
                    </Button>
                  </div>
                </div>

                {/* Features */}
                <div className="md:col-span-2">
                  <h4 className="text-[var(--text-primary)] font-semibold text-sm mb-4">What is included:</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {features.map(({ label, desc }) => (
                      <div key={label} className="flex gap-3">
                        <div className="mt-0.5 w-5 h-5 rounded-full bg-[rgba(201,146,42,0.16)] flex items-center justify-center shrink-0">
                          <Check size={12} className="text-[var(--leo-amber)]" />
                        </div>
                        <div>
                          <div className="text-[var(--text-primary)] text-sm font-medium">{label}</div>
                          <div className="text-[var(--text-secondary)] text-xs leading-relaxed mt-0.5">{desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-[var(--text-secondary)] mb-4">Not sure which program fits you best?</p>
          <Button
            href="https://wa.me/9063443115?text=Hi%20Leovex%2C%20I%20need%20help%20choosing%20a%20program!"
            variant="whatsapp"
            className="text-base px-8 py-4"
          >
            <MessageCircle size={18} />
            Talk to Leovex on WhatsApp
          </Button>
        </div>
      </div>
    </div>
  )
}
