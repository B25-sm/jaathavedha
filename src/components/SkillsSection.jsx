import SectionHeading from './SectionHeading'

const skillGroups = [
  {
    category: 'Frontend',
    color: 'from-cyan-500/20 to-cyan-500/5',
    border: 'border-cyan-500/30',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    skills: ['React', 'HTML5', 'CSS3', 'JavaScript (ES6+)'],
  },
  {
    category: 'Backend',
    color: 'from-green-500/20 to-green-500/5',
    border: 'border-green-500/30',
    badge: 'bg-green-500/10 text-green-400 border-green-500/20',
    skills: ['Node.js', 'REST APIs', 'Express.js'],
  },
  {
    category: 'AI & Agents',
    color: 'from-violet-500/20 to-violet-500/5',
    border: 'border-violet-500/30',
    badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    skills: ['AI Chatbots', 'AI Agents', 'LangChain', 'LangGraph', 'n8n Workflows'],
  },
]

export default function SkillsSection() {
  return (
    <section id="skills" className="py-24 px-4 bg-gray-950/50">
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
              <h3 className="text-white font-bold text-lg mb-5">{category}</h3>
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
