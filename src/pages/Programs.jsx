import { Check, ArrowRight, MessageCircle } from 'lucide-react'
import Button from '../components/Button'
import SectionHeading from '../components/SectionHeading'

const programs = [
  {
    tier: 'Foundation',
    price: '\u20b9499',
    tagline: 'Perfect for absolute beginners',
    color: 'border-cyan-500/30',
    glow: 'from-cyan-500/10',
    features: [
      { label: 'React Fundamentals', desc: 'Components, props, state, hooks — the core of modern frontend.' },
      { label: 'AI Basics', desc: 'Understand what AI is, how chatbots work, and where to start.' },
      { label: 'Mini Project', desc: 'Build a real mini app to apply what you learn.' },
      { label: 'Learning Roadmap', desc: 'A clear path from beginner to job-ready developer.' },
      { label: 'Community Access', desc: 'Join a group of learners for support and accountability.' },
    ],
    outcomes: ['Understand React basics', 'Build a mini project', 'Know your next steps'],
    whatsapp: 'Hi Leovex, I want to enroll in the Foundation program!',
  },
  {
    tier: 'Builder',
    price: '\u20b9999 \u2013 \u20b91,999',
    tagline: 'For learners ready to build real things',
    color: 'border-violet-500',
    glow: 'from-violet-500/15',
    highlighted: true,
    features: [
      { label: 'Real-World Projects', desc: 'Build apps that solve actual problems, not just tutorials.' },
      { label: 'REST API Integration', desc: 'Connect your frontend to real APIs and handle data.' },
      { label: 'Debugging Techniques', desc: 'Learn how to read errors, fix bugs, and think like a developer.' },
      { label: 'AI Integration', desc: 'Add AI features to your apps using simple APIs.' },
      { label: 'Code Review Sessions', desc: 'Get feedback on your code from an experienced trainer.' },
      { label: 'WhatsApp Support', desc: 'Ask questions and get answers whenever you are stuck.' },
    ],
    outcomes: ['Build 2\u20133 real projects', 'Integrate APIs and AI', 'Debug confidently'],
    whatsapp: 'Hi Leovex, I want to enroll in the Builder program!',
  },
  {
    tier: 'Professional',
    price: '\u20b92,999 \u2013 \u20b95,000',
    tagline: 'For developers aiming at jobs and freelancing',
    color: 'border-pink-500/30',
    glow: 'from-pink-500/10',
    features: [
      { label: 'Full Fullstack Systems', desc: 'Build complete apps with React frontend and Node.js backend.' },
      { label: 'AI Apps with LangChain', desc: 'Build production-grade AI applications using LangChain.' },
      { label: 'LangGraph Agents', desc: 'Create multi-step AI agents that reason and act.' },
      { label: 'n8n Automation', desc: 'Automate workflows and integrate tools without code.' },
      { label: 'Portfolio + Resume', desc: 'Build a portfolio that stands out and a resume that gets calls.' },
      { label: 'Interview Preparation', desc: 'Mock interviews, common questions, and how to answer them.' },
      { label: '1-on-1 Mentorship', desc: 'Direct sessions with Leovex for personalized guidance.' },
    ],
    outcomes: ['Job-ready portfolio', 'AI + Fullstack skills', 'Interview confidence'],
    whatsapp: 'Hi Leovex, I want to enroll in the Professional program!',
  },
]

export default function Programs() {
  return (
    <div className="pt-24 pb-16 px-4 min-h-screen bg-gray-950">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="All Programs"
          title="Find the Right Program for You"
          subtitle="Each tier is designed for a specific stage of your learning journey. Start where you are."
        />

        <div className="flex flex-col gap-10">
          {programs.map(({ tier, price, tagline, color, glow, highlighted, features, outcomes, whatsapp }) => (
            <div
              key={tier}
              className={`relative rounded-2xl bg-gradient-to-br ${glow} to-gray-900 border ${color} p-6 sm:p-8 ${
                highlighted ? 'shadow-xl shadow-violet-500/10' : ''
              }`}
            >
              {highlighted && (
                <div className="absolute -top-3 left-6">
                  <span className="px-4 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-8">
                {/* Header */}
                <div className="md:col-span-1">
                  <h2 className="text-2xl font-extrabold text-white mb-1">{tier}</h2>
                  <div className="text-3xl font-extrabold gradient-text mb-2">{price}</div>
                  <p className="text-gray-400 text-sm mb-6">{tagline}</p>

                  <div className="mb-6">
                    <h4 className="text-white font-semibold text-sm mb-3">What you will achieve:</h4>
                    <ul className="space-y-2">
                      {outcomes.map((o) => (
                        <li key={o} className="flex items-center gap-2 text-sm text-gray-300">
                          <ArrowRight size={14} className="text-violet-400 shrink-0" />
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
                  <h4 className="text-white font-semibold text-sm mb-4">What is included:</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {features.map(({ label, desc }) => (
                      <div key={label} className="flex gap-3">
                        <div className="mt-0.5 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                          <Check size={12} className="text-violet-400" />
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium">{label}</div>
                          <div className="text-gray-400 text-xs leading-relaxed mt-0.5">{desc}</div>
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
          <p className="text-gray-400 mb-4">Not sure which program to pick?</p>
          <Button
            href="https://wa.me/9063443115?text=Hi%20Leovex%2C%20I%20need%20help%20choosing%20a%20program!"
            variant="whatsapp"
            className="text-base px-8 py-4"
          >
            <MessageCircle size={18} />
            Ask Leovex on WhatsApp
          </Button>
        </div>
      </div>
    </div>
  )
}
