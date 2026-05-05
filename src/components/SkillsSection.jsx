import SectionHeading from './SectionHeading'

const skillGroups = [
  {
    category: 'Frontend',
    color: 'from-[rgba(201,146,42,0.2)] to-[rgba(201,146,42,0.05)]',
    border: 'border-[var(--border-gold)]',
    badge: 'bg-[rgba(201,146,42,0.12)] text-[var(--leo-amber)] border-[var(--border-gold)]',
    skills: ['React', 'HTML5', 'CSS3', 'JavaScript (ES6+)'],
  },
  {
    category: 'Backend',
    color: 'from-[rgba(245,200,66,0.2)] to-[rgba(245,200,66,0.05)]',
    border: 'border-[var(--border-gold)]',
    badge: 'bg-[rgba(245,200,66,0.12)] text-[var(--leo-sunlit)] border-[var(--border-gold)]',
    skills: ['Node.js', 'REST APIs', 'Express.js'],
  },
  {
    category: 'AI & Agents',
    color: 'from-[rgba(155,110,26,0.25)] to-[rgba(122,79,16,0.1)]',
    border: 'border-[var(--border-gold)]',
    badge: 'bg-[rgba(155,110,26,0.2)] text-[var(--leo-amber)] border-[var(--border-gold)]',
    skills: ['AI Chatbots', 'AI Agents', 'LangChain', 'LangGraph', 'n8n Workflows'],
  },
]

export default function SkillsSection() {
  return (
    <section id="skills" className="py-24 px-4 leo-section-card">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="Skills Covered"
          title="What You'll Actually Learn"
          subtitle="A focused stack that covers everything from UI to AI — the skills employers want."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {skillGroups.map(({ category, color, border, badge, skills }) => (
            <div
              key={category}
              className={`rounded-2xl bg-gradient-to-b ${color} border ${border} p-6 card-hover`}
            >
              <h3 className="text-[var(--text-primary)] font-bold text-lg mb-5" style={{ fontFamily: 'var(--font-display)' }}>{category}</h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <span
                    key={s}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${badge}`}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
