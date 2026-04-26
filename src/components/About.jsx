import { Code2, Brain, Layers, Award } from 'lucide-react'
import SectionHeading from './SectionHeading'

const skills = [
  { icon: Code2, label: 'React', color: 'text-cyan-400' },
  { icon: Code2, label: 'HTML & CSS', color: 'text-orange-400' },
  { icon: Code2, label: 'JavaScript', color: 'text-yellow-400' },
  { icon: Layers, label: 'Node.js', color: 'text-green-400' },
  { icon: Brain, label: 'AI Chatbots', color: 'text-violet-400' },
  { icon: Brain, label: 'LangChain', color: 'text-violet-400' },
  { icon: Brain, label: 'LangGraph', color: 'text-cyan-400' },
  { icon: Layers, label: 'n8n Workflows', color: 'text-pink-400' },
]

const highlights = [
  { icon: Award, label: '2+ Years', sub: 'as a trainer' },
  { icon: Code2, label: 'Fullstack', sub: 'React + Node.js' },
  { icon: Brain, label: 'AI & Agents', sub: 'LangChain, LangGraph' },
  { icon: Layers, label: 'Automation', sub: 'n8n workflows' },
]

export default function About() {
  return (
    <section id="about" className="py-24 px-4 bg-gray-950">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="About the Trainer"
          title="Meet Leovex"
          subtitle="A hands-on trainer focused on teaching what the industry actually uses — not just theory."
        />

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {highlights.map(({ icon: Icon, label, sub }) => (
                <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <Icon size={20} className="text-violet-400 mb-2" />
                  <div className="text-white font-bold">{label}</div>
                  <div className="text-gray-400 text-sm">{sub}</div>
                </div>
              ))}
            </div>
            <p className="text-gray-400 leading-relaxed">
              With over 2 years of training experience, Leovex specializes in helping college students and beginners break into Fullstack development and AI engineering. Every program is built around real projects, clear explanations, and practical outcomes — no fluff.
            </p>
          </div>

          {/* Right: skills */}
          <div>
            <h3 className="text-white font-semibold mb-5 text-lg">Technologies Covered</h3>
            <div className="flex flex-wrap gap-3">
              {skills.map(({ icon: Icon, label, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-violet-500/50 transition-colors"
                >
                  <Icon size={16} className={color} />
                  <span className="text-gray-200 text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
