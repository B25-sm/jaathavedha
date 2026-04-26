import SectionHeading from './SectionHeading'
import PricingCard from './PricingCard'
import LeoShimmer from './leo/LeoShimmer'

const programs = [
  {
    tier: 'Leovex Starter',
    price: '₹499',
    features: [
      'One guided live session or focused sprint',
      'One complete mini-project (your first real build)',
      'Fullstack clarity session for your chosen track',
      'AI fundamentals for developers',
      'Personalised learning roadmap',
      'Limited community access',
    ],
    cta: 'Start for ₹499',
    highlighted: false,
  },
  {
    tier: 'Leovex Membership',
    price: '₹999/month',
    features: [
      'Weekly live build sessions',
      'Monthly project sprints',
      'AI tools, chatbots, workflows & agent demos',
      'Dedicated doubt-solving sessions',
      'Full community access + new learning drops',
      'Monthly Build-and-Ship challenges',
      'Dashboard-based progress tracking',
    ],
    cta: 'Join the Membership',
    highlighted: true,
  },
  {
    tier: 'Leovex Accelerator',
    price: '₹2,999',
    features: [
      'Choose your stack: MERN, Python or Java Fullstack',
      'Real-world project building from scratch',
      'API integration & debugging workflows',
      'AI integration into your chosen stack',
      'Portfolio guidance + resume structure',
      'Interview prep basics',
      'Small-batch learning (max 10 students)',
    ],
    cta: 'Enroll Now',
    highlighted: false,
  },
  {
    tier: 'Leovex Pro Developer',
    price: '₹4,999',
    features: [
      'Everything in Accelerator',
      'Advanced AI: Agents, Chatbots, LangChain, LangGraph, n8n',
      'One major capstone project',
      'Code review & mentor feedback',
      'Resume polishing + portfolio refinement',
      'Mock interview session',
      'Priority support + premium small-batch mentoring',
      'Placement assistance for Top 2 performers',
    ],
    cta: 'Go Pro',
    highlighted: false,
  },
]

export default function ProgramsSection() {
  return (
    <section id="programs" className="py-24 px-4 leo-section-card leo-section-grid">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="Programs"
          title="The Leovex Value Ladder"
          subtitle="From your very first line of code to a job-ready AI + Fullstack developer — every step is engineered for real outcomes."
        />
        <LeoShimmer className="mb-10" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
          {programs.map((p) => (
            <PricingCard key={p.tier} {...p} />
          ))}
        </div>
      </div>
    </section>
  )
}
