import Hero from '../components/sections/Hero'
import FounderCredibility from '../components/sections/FounderCredibility'
import LeovexEdge from '../components/LeovexEdge'
import LearningTracks from '../components/sections/LearningTracks'
import CareerSupport from '../components/sections/CareerSupport'
import AISpecialization from '../components/sections/AISpecialization'
import Testimonials from '../components/sections/Testimonials'
import FinalCTA from '../components/sections/FinalCTA'

export default function Home() {
  return (
    <>
      <Hero />
      <LeovexEdge />
      <FounderCredibility />
      <LearningTracks />
      <CareerSupport />
      <AISpecialization />
      <Testimonials />
      <FinalCTA />
    </>
  )
}
