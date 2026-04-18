import { Rocket, Wrench, Target, TrendingUp } from 'lucide-react'
import SectionHeading from './SectionHeading'

const reasons = [
  {
    icon: Target,
    title: 'No Unnecessary Theory',
    desc: 'Every lesson is tied to a real use case. You learn by building, not by memorizing.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    icon: Wrench,
    title: 'Real-World Projects',
    desc: 'Build actual apps you can show in your portfolio — not toy examples.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: Rocket,
    title: 'Fast-Track Learning',
    desc: 'Structured curriculum that gets you from zero to job-ready in the shortest path.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
  },
  {
    icon: TrendingUp,
    title: 'Industry-Relevant Skills',
    desc: 'React, Node.js, AI Agents, LangChain — exactly what companies are hiring for right now.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
]

export default function WhyChoose() {
  return (
    <section id="why" className="py-24 px-4 bg-gray-950">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="Why This Program"
          title="Built for Results, Not Certificates"
          subtitle="Most courses leave you stuck. This one is designed to get you unstuck."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {reasons.map(({ icon: Icon, title, desc, color, bg }) => (
            <div
              key={title}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 card-hover"
            >
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                <Icon size={22} className={color} />
              </div>
              <h3 className="text-white font-bold mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
