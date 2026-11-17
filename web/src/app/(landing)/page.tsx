import { Nav } from "@/components/landing/nav";
import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { Case, FaqSection, Features, Footer, Hero, Partners, Pricing, Problem } from "@/components/landing/sections";

export default function LandingPage() {
  return (
    <main className="ld">
      <SmoothScroll />
      <Nav />
      <Hero />
      <Problem />
      <Features />
      <Case />
      <Pricing />
      <Partners />
      <FaqSection />
      <Footer />
    </main>
  );
}
