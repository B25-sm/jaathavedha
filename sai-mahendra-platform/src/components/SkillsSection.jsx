import SectionHeading from './SectionHeading'

const skillGroups = [
  {
    category: 'MERN Stack',
    label: 'Fullstack Track 1',
    color: 'from-[rgba(201,146,42,0.2)] to-[rgba(201,146,42,0.05)]',
    border: 'border-[var(--border-gold)]',
    badge: 'bg-[rgba(201,146,42,0.12)] text-[var(--leo-amber)] border-[var(--border-gold)]',
    aiBadge: 'bg-[rgba(245,200,66,0.12)] text-[var(--leo-sunlit)] border-[var(--border-gold)]',
    skills: ['MongoDB', 'Express.js', 'React', 'Node.js', 'REST APIs', 'JavaScript (ES6+)'],
    aiSkills: ['AI Agents', 'AI Chatbots', 'LangChain', 'n8n Workflows'],
  },
  {
    category: 'Python Fullstack',
    label: 'Fullstack Track 2',
    color: 'from-[rgba(245,200,66,0.2)] to-[rgba(245,200,66,0.05)]',
    border: 'border-[var(--border-gold)]',
    badge: 'bg-[rgba(245,200,66,0.12)] text-[var(--leo-sunlit)] border-[var(--border-gold)]',
    aiBadge: 'bg-[rgba(201,146,42,0.12)] text-[var(--leo-amber)] border-[var(--border-gold)]',
    skills: ['Python', 'Django / Flask', 'REST APIs', 'SQL / PostgreSQL', 'React (Frontend)', 'Deployment'],
    aiSkills: ['AI Agents', 'LangChain', 'LangGraph', 'AI Automations'],
  },
  {
    category: 'Java Fullstack',
    label: 'Fullstack Track 3',
    color: 'from-[rgba(155,110,26,0.25)] to-[rgba(122,79,16,0.1)]',
    border: 'border-[var(--border-gold)]',
    badge: 'bg-[rgba(155,110,26,0.2)] text-[var(--leo-amber)] border-[var(--border-gold)]',
    aiBadge: 'bg-[rgba(245,200,66,0.12)] text-[var(--leo-sunlit)] border-[var(--border-gold)]',
    skills: ['Core Java', 'Spring Boot', 'Hibernate / JPA', 'REST APIs', 'MySQL', 'React (Frontend)'],
    aiSkills: ['AI Chatbots', 'LangChain', 'n8n Workflows', 'AI Automations'],
  },
]

export default function SkillsSection() {
  return (
    <section id="skills" className="py-24 px-4 leo-section-card">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="Learning Tracks"
          title="Every Track Comes with AI Built In"
          subtitle="Pick your Fullstack path — MERN, Python, or Java — and AI integration is not optional. It is part of every single track."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {skillGroups.map(({ category, label, color, border, badge, aiBadge, skills, aiSkills }) => (
            <div
              key={category}
              className={`rounded-2xl bg-gradient-to-b ${color} border ${border} p-6 card-hover flex flex-col gap-5`}
            >
              {/* Track label + title */}
              <div>
                <span className={`text-xs font-semibold uppercase tracking-widest px-2 py-1 rounded-md border ${badge} mb-3 inline-block`}>
                  {label}
                </span>
                <h3 className="text-[var(--text-primary)] font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>{category}</h3>
              </div>

              {/* Core stack skills */}
              <div>
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-2 font-semibold">Core Stack</p>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <span key={s} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${badge}`}>{s}</span>
                  ))}
                </div>
              </div>

              {/* AI layer — always included */}
              <div>
                <p className="text-[var(--leo-sunlit)] text-xs uppercase tracking-widest mb-2 font-semibold">+ AI Layer (Included)</p>
                <div className="flex flex-wrap gap-2">
                  {aiSkills.map((s) => (
                    <span key={s} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${aiBadge}`}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
