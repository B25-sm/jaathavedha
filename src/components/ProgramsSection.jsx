import SectionHeading from './SectionHeading'
import PricingCard from './PricingCard'

const programs = [
  {
    tier: 'Foundation',
    price: '₹499',
    features: [
      'React fundamentals',
      'AI basics introduction',
      'Mini project included',
      'Learning roadmap',
      'Community access',
    ],
    cta: 'Enroll Now',
    highlighted: false,
  },
  {
    tier: 'Builder',
    price: '₹999 – ₹1,999',
    features: [
      'Real-world project builds',
      'REST API integration',
      'Debugging techniques',
      'AI integration basics',
      'Code review sessions',
      'WhatsApp support',
    ],
    cta: 'Enroll Now',
    highlighted: true,
  },
  {
    tier: 'Professional',
    price: '₹2,999 – ₹5,000',
    features: [
      'Full Fullstack systems',
      'AI apps with LangChain',
      'Portfolio + Resume prep',
      'Interview preparation',
      'Agentic AI workflows',
      'n8n automation',
      '1-on-1 mentorship',
    ],
    cta: 'Enroll Now',
    highlighted: false,
  },
]

export default function ProgramsSection() {
  return (
    <section id="programs" className="py-24 px-4 bg-gray-950/50">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="Programs"
          title="Choose Your Learning Path"
          subtitle="Three tiers designed to meet you where you are — from complete beginner to job-ready developer."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {programs.map((p) => (
            <PricingCard key={p.tier} {...p} />
          ))}
        </div>
      </div>
    </section>
  )
}
