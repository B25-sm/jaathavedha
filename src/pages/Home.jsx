import Hero from '../components/Hero'
import About from '../components/About'
import ProgramsSection from '../components/ProgramsSection'
import WhyChoose from '../components/WhyChoose'
import SkillsSection from '../components/SkillsSection'
import Testimonials from '../components/Testimonials'
import FinalCTA from '../components/FinalCTA'

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <ProgramsSection />
      <WhyChoose />
      <SkillsSection />
      <Testimonials />
      <FinalCTA />
    </>
  )
}
