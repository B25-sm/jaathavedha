import { Code2, Brain, Layers, Award } from 'lucide-react'
import SectionHeading from './SectionHeading'
import LeoCountUp from './ui/LeoCountUp'

const skills = [
  { icon: Code2, label: 'Java Fullstack', color: 'text-[var(--leo-amber)]' },
  { icon: Code2, label: 'Python Fullstack', color: 'text-[var(--leo-sunlit)]' },
  { icon: Code2, label: 'MERN Stack', color: 'text-[var(--leo-gold)]' },
  { icon: Layers, label: 'Node.js', color: 'text-[var(--leo-amber)]' },
  { icon: Brain, label: 'AI Agents', color: 'text-[var(--leo-sunlit)]' },
  { icon: Brain, label: 'AI Chatbots', color: 'text-[var(--leo-gold)]' },
  { icon: Brain, label: 'LangChain', color: 'text-[var(--leo-amber)]' },
  { icon: Brain, label: 'LangGraph', color: 'text-[var(--leo-sunlit)]' },
  { icon: Layers, label: 'n8n Workflows', color: 'text-[var(--leo-gold)]' },
  { icon: Brain, label: 'AI Automations', color: 'text-[var(--leo-amber)]' },
]

const highlights = [
  { icon: Award, label: 'Years Training', value: 2, suffix: '+', sub: 'as an EdTech trainer' },
  { icon: Code2, label: 'Students Taught', value: 2000, suffix: '+', sub: 'real outcomes delivered' },
  { icon: Brain, label: 'College Seminars', value: 15, suffix: '+', sub: 'workshops conducted' },
  { icon: Layers, label: 'AI Modules', value: 20, suffix: '+', sub: 'hands-on AI sessions' },
]

export default function About() {
  return (
    <section id="about" className="py-24 px-4 leo-section-dark">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="About the Founder"
          title="Meet Sai Mahendra"
          subtitle="The trainer behind Leovex — 2+ years, 2000+ students, and a relentless focus on real outcomes over empty certificates."
        />

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {highlights.map(({ icon: Icon, label, value, suffix, sub }) => (
                <div key={label} className="leo-card rounded-xl p-4">
                  <Icon size={20} className="text-[var(--leo-amber)] mb-2" />
                  <div className="text-[var(--leo-sunlit)] font-bold text-xl" style={{ fontFamily: 'var(--font-display)' }}>
                    <LeoCountUp end={value} suffix={suffix} />
                  </div>
                  <div className="text-[var(--text-primary)] font-semibold text-sm">{label}</div>
                  <div className="text-[var(--text-secondary)] text-sm">{sub}</div>
                </div>
              ))}
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Sai Mahendra is the founder and lead trainer at Leovex — an EdTech professional with 2+ years of hands-on training experience and 2000+ students taught across college seminars, workshops, and structured programs. He has conducted sessions at multiple colleges, helping students break through confusion and build real, deployable skills in Java Fullstack, Python Fullstack, MERN Stack, and cutting-edge AI systems including Agents, LangChain, LangGraph, and n8n. Every Leovex program is a direct reflection of his belief: that the right structure, the right projects, and the right mentor can compress years of learning into weeks.
            </p>
          </div>

          {/* Right: skills */}
          <div>
            <h3 className="text-[var(--text-primary)] font-semibold mb-5 text-lg" style={{ fontFamily: 'var(--font-display)' }}>Teaching Expertise</h3>
            <div className="flex flex-wrap gap-3">
              {skills.map(({ icon: Icon, label, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-gold)] hover:border-[var(--border-gold-hover)] transition-colors"
                >
                  <Icon size={16} className={color} />
                  <span className="text-[var(--text-primary)] text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
