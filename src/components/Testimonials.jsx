import { useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import SectionHeading from './SectionHeading'

const testimonials = [
  {
    name: 'Ravi Kumar',
    role: 'BTech CSE → MERN Developer',
    text: 'I spent 6 months watching YouTube tutorials and going nowhere. After 4 weeks in the Leovex Accelerator, I had a real full-stack app in my portfolio and my first interview call. The batch size of 10 made all the difference — every doubt got answered.',
    stars: 5,
  },
  {
    name: 'Priya Sharma',
    role: 'Fresher → Junior AI Developer',
    text: 'The AI modules — LangChain, LangGraph, n8n — are unlike anything I found online. Sai explains complex concepts in a way that actually sticks. I finished the Pro Developer Track as a Top 2 performer and got placement assistance that landed me my first role.',
    stars: 5,
  },
  {
    name: 'Arjun Reddy',
    role: 'Degree Student → Freelancer',
    text: 'Started with the ₹499 Starter to test the waters. The clarity session alone was worth 10x the price. Upgraded to the Membership and now I ship a new project every month. Leovex is not a course — it is a system.',
    stars: 5,
  },
  {
    name: 'Divya Nair',
    role: 'Python Fullstack Track',
    text: 'What sets Leovex apart is the personal attention. In a batch of 10, you cannot hide and you cannot fall behind — the trainer notices. That accountability pushed me harder than any self-paced course ever could.',
    stars: 5,
  },
  {
    name: 'Karthik Reddy',
    role: 'Java Fullstack Track',
    text: 'Sai conducted a seminar at our college and I was blown away by how clearly he explained enterprise Java concepts. Joined the Accelerator immediately. The structured roadmap and real projects gave me the confidence to crack my campus placement.',
    stars: 5,
  },
  {
    name: 'Sneha Patel',
    role: 'Leovex Membership Student',
    text: 'The monthly Build-and-Ship challenges are addictive. I have shipped 6 projects in 6 months — each one better than the last. The community keeps me accountable and the weekly live sessions keep me sharp.',
    stars: 5,
  },
]

export default function Testimonials() {
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef(null)

  useEffect(() => {
    const node = sectionRef.current
    if (!node) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="testimonials" className="py-24 px-4 leo-section-dark">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="Student Reviews"
          title="Real Students. Real Outcomes."
          subtitle="2000+ students trained. Here is what a few of them have to say about the Leovex experience."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map(({ name, role, text, stars }, i) => (
            <div
              key={name}
              className="leo-card rounded-2xl p-6 card-hover"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(24px)',
                transition: `opacity 0.55s ease ${80 * i}ms, transform 0.55s ease ${80 * i}ms`,
              }}
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} size={16} className="text-[var(--leo-sunlit)] fill-[var(--leo-sunlit)]" />
                ))}
              </div>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-5">"{text}"</p>
              <div>
                <div className="text-[var(--leo-amber)] font-semibold text-sm">{name}</div>
                <div className="text-[var(--text-muted)] text-xs">{role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
