import { Star } from 'lucide-react'
import SectionHeading from './SectionHeading'

const testimonials = [
  {
    name: 'Ravi Kumar',
    role: 'BTech Student',
    text: 'I was stuck in tutorial hell for months. After joining the Builder program, I built my first real API-integrated app in 3 weeks.',
    stars: 5,
  },
  {
    name: 'Priya Sharma',
    role: 'Fresher → Junior Dev',
    text: 'The AI integration module was a game changer. I now have a portfolio with 3 real projects and got my first interview call.',
    stars: 5,
  },
  {
    name: 'Arjun Reddy',
    role: 'Degree Student',
    text: 'Started with Foundation at ₹499 and upgraded to Professional. Best investment I made in my learning journey.',
    stars: 5,
  },
]

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-24 px-4 bg-gray-950">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="Student Reviews"
          title="What Students Say"
          subtitle="Real feedback from students who went from confused to confident."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map(({ name, role, text, stars }) => (
            <div
              key={name}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 card-hover"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-gray-300 text-sm leading-relaxed mb-5">"{text}"</p>
              <div>
                <div className="text-white font-semibold text-sm">{name}</div>
                <div className="text-gray-500 text-xs">{role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
