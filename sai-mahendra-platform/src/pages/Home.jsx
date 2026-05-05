import Hero from '../components/sections/Hero'
import FounderCredibility from '../components/sections/FounderCredibility'
import LeovexEdge from '../components/LeovexEdge'
import WhyUs from '../components/sections/WhyUs'
import LearningTracks from '../components/sections/LearningTracks'
import CareerSupport from '../components/sections/CareerSupport'
import AISpecialization from '../components/sections/AISpecialization'
import MarketDemand from '../components/MarketDemand'
import Testimonials from '../components/sections/Testimonials'
import FinalCTA from '../components/sections/FinalCTA'

export default function Home() {
  return (
    <>
      <Hero />
      <LeovexEdge />
      <WhyUs />
      <FounderCredibility />
      <LearningTracks />
      <AISpecialization />
      <MarketDemand />
      <CareerSupport />
      <Testimonials />
      <FinalCTA />
    </>
  )
}
