"use client";

import React, { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Users, 
  Droplets, 
  Building2, 
  Smartphone,
  CheckCircle2,
  Cpu,
  Wallet,
  ShieldCheck,
  LineChart
} from "lucide-react";
import { 
  Button, 
  Badge, 
  Nav,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from "@/components/ui";
import { Marquee } from "@/components/marketing/marquee";
import { LeadForm } from "@/components/marketing/lead-form";
import { FadeIn } from "@/components/marketing/fade-in";

export default function MarketingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-offwhite" />}>
      <MarketingPageContent />
    </Suspense>
  );
}

function MarketingPageContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
    <div className="min-h-screen bg-offwhite selection:bg-yellow-200">
      {/* 1. Navigation */}
      <Nav
        links={[
          { label: "How it works", href: "#how-it-works" },
          { label: "Paths", href: "#paths" },
          { label: "The App", href: "#app" },
          { label: "For Business", href: "#business" },
        ]}
        className="fixed border-b-navy-100/50"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <DialogTrigger asChild>
              <Button variant="primary" size="sm">Book consultation</Button>
            </DialogTrigger>
          </div>
        }
        mobileActions={
          <div className="flex flex-col gap-2 w-full">
            <Button asChild variant="secondary" className="w-full">
              <Link href="/sign-in">Sign in / Create account</Link>
            </Button>
            <DialogTrigger asChild>
              <Button variant="primary" className="w-full">Book consultation</Button>
            </DialogTrigger>
          </div>
        }
      />

      <main>
        {/* 2. Hero Section */}
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <FadeIn className="space-y-8">
                <Badge variant="success" dot pulse className="py-1 px-4 text-sm font-bold bg-green-50">
                  Now onboarding Lagos pilot hosts
                </Badge>
                <h1 className="text-5xl lg:text-7xl font-display font-bold text-navy-950 leading-[1.1] tracking-tight">
                  Be your own <span className="italic text-yellow-500">NEPA.</span> <br />
                  <span className="text-navy-900">Sell power to your neighbors.</span>
                </h1>
                <p className="text-xl text-navy-700 font-sans max-w-lg leading-relaxed">
                  T&S Power Grid turns your Excess Solar capacity into a reliable monthly income. Join Nigeria&apos;s first peer-to-peer micro-utility network.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <DialogTrigger asChild>
                    <Button size="lg" className="h-14 px-8 text-lg font-bold shadow-lg shadow-yellow-500/20">
                      Become a host
                    </Button>
                  </DialogTrigger>
                  <Button asChild variant="secondary" size="lg" className="h-14 px-8 text-lg font-bold">
                    <a href="#how-it-works">See how it works</a>
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-4 border-t border-navy-100">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-navy-400">Installment</span>
                    <span className="font-mono text-lg font-bold text-navy-900">3 mo terms</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-navy-400">Fixed Rate</span>
                    <span className="font-mono text-lg font-bold text-navy-900">₦280/kWh</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-navy-400">Vs Market</span>
                    <span className="font-mono text-lg font-bold text-green-600">~40% cheaper</span>
                  </div>
                </div>
              </FadeIn>

              <FadeIn direction="left" className="relative lg:ml-auto">
                <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
                  <Image 
                    src="/images/hero-dashboard.png" 
                    alt="T&S Power Grid Dashboard" 
                    width={600} 
                    height={600}
                    className="w-full h-auto"
                    priority
                  />
                  {/* Floating Metric */}
                  <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-xl border border-white/50">
                     <span className="text-[10px] font-bold text-navy-400 block mb-1">LIVE EARNINGS</span>
                     <span className="text-2xl font-mono font-bold text-navy-950">₦4,250.00</span>
                     <div className="flex gap-1 mt-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse delay-75" />
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse delay-150" />
                     </div>
                  </div>
                </div>
                <div className="absolute -bottom-6 -right-6 h-32 w-32 bg-yellow-400/20 rounded-full blur-3xl" />
                <div className="absolute -top-12 -left-12 h-64 w-64 bg-navy-500/10 rounded-full blur-3xl" />
              </FadeIn>
            </div>
          </div>
        </section>

        {/* 3. Scrolling Marquee */}
        <Marquee 
          items={[
            "Infrastructure for micro-utilities",
            "Made in Lagos",
            "Peer-to-peer power sharing",
            "Turn solar into income",
            "Powered by sun, priced by you"
          ]}
          className="my-10"
        />

        {/* 4. How It Works */}
        <section id="how-it-works" className="py-24 bg-paper/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-16">
            <FadeIn className="space-y-4 max-w-3xl mx-auto">
              <span className="text-sm font-bold tracking-widest text-yellow-600 uppercase">HOW IT WORKS</span>
              <h2 className="text-4xl lg:text-6xl font-display font-bold text-navy-950">
                Solar you own. Power you sell.
              </h2>
            </FadeIn>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {[
                { 
                  step: "01", 
                  title: "Install or Upgrade", 
                  desc: "Choose a full stack or use our upgrade kit for your existing solar. We handle the grid-balancing hardware.",
                  icon: Cpu
                },
                { 
                  step: "02", 
                  title: "Invite Neighbors", 
                  desc: "Neighbors within 200m join via the app. No heavy cables, just smart metering and local distribution.",
                  icon: Users
                },
                { 
                  step: "03", 
                  title: "Earn Automatically", 
                  desc: "As neighbors consume power, your wallet grows in real-time. Withdraw earnings directly to your bank.",
                  icon: Wallet
                }
              ].map((item, idx) => (
                <FadeIn 
                  key={idx} 
                  delay={idx * 0.1}
                  className="group p-8 bg-white rounded-2xl border border-navy-100 hover:border-yellow-500 transition-all hover:shadow-xl"
                >
                  <div className="flex items-center justify-between mb-8">
                    <span className="font-mono text-4xl font-bold text-navy-100 group-hover:text-yellow-100 transition-colors">
                      {item.step}
                    </span>
                    <div className="h-12 w-12 rounded-xl bg-navy-50 flex items-center justify-center text-navy-900 group-hover:bg-yellow-500 group-hover:text-navy-950 transition-all">
                      <item.icon className="h-6 w-6" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-display font-bold text-navy-900 mb-4">{item.title}</h3>
                  <p className="text-navy-600 font-sans leading-relaxed">{item.desc}</p>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Two Paths */}
        <section id="paths" className="py-24 bg-white overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
            <FadeIn className="text-center">
              <h2 className="text-4xl font-display font-bold text-navy-950">Choose your path to income</h2>
            </FadeIn>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              <FadeIn className="bg-navy-900 rounded-[32px] p-8 lg:p-12 text-white flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-3xl font-display font-bold mb-2">Full Stack Host</h3>
                      <p className="text-navy-300 font-sans">For sites with no existing solar.</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-3xl font-bold block">₦6M</span>
                      <span className="text-xs uppercase text-navy-400 font-bold tracking-widest">STARTING AT</span>
                    </div>
                  </div>
                  <ul className="space-y-4 mb-12">
                    {[
                      "8kW Inverter + 10kWh Battery",
                      "12 High-Efficiency Solar Panels",
                      "T&S Micro-Grid Controller & Meter",
                      "Full Professional Installation",
                      "Grid-Scale Maintenance Support"
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center space-x-3 text-navy-100">
                        <CheckCircle2 className="h-5 w-5 text-yellow-500 shrink-0" />
                        <span className="text-sm font-medium">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <DialogTrigger asChild>
                  <Button className="w-full h-14 bg-yellow-500 text-navy-950 hover:bg-yellow-400 font-bold">
                    Book Full Audit
                  </Button>
                </DialogTrigger>
              </FadeIn>

              <FadeIn delay={0.2} className="bg-yellow-500 rounded-[32px] p-8 lg:p-12 text-navy-950 flex flex-col justify-between relative overflow-hidden">
                <Badge className="absolute top-6 right-6 bg-navy-900 text-yellow-500 uppercase font-bold tracking-tighter">
                  Fastest entry
                </Badge>
                <div>
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-3xl font-display font-bold mb-2">Upgrade Kit</h3>
                      <p className="text-navy-900/60 font-sans">For existing solar owners.</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-3xl font-bold block">₦800K+</span>
                      <span className="text-xs uppercase text-navy-900/40 font-bold tracking-widest">ONE-TIME FEE</span>
                    </div>
                  </div>
                  <ul className="space-y-4 mb-12">
                    {[
                      "Universal Micro-Grid Controller",
                      "Smart Bi-Directional Meter",
                      "T&S Host App Integration",
                      "Compliance Audit & Testing",
                      "Dynamic Pricing Software"
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center space-x-3 text-navy-950">
                        <CheckCircle2 className="h-5 w-5 text-navy-900 shrink-0" />
                        <span className="text-sm font-medium">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <DialogTrigger asChild>
                  <Button className="w-full h-14 bg-navy-900 text-white hover:bg-navy-950 font-bold">
                    Check Compatibility
                  </Button>
                </DialogTrigger>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* 6. Big Stat */}
        <section className="py-32 bg-navy-950 text-center relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
            <FadeIn className="space-y-6">
              <h2 className="text-navy-400 text-sm font-bold tracking-widest uppercase">THE OPPORTUNITY</h2>
              <div className="space-y-2">
                <span className="text-[10vw] font-display font-bold leading-none text-yellow-500">₦180,000</span>
                <span className="block text-2xl lg:text-3xl text-white font-sans font-medium">Average monthly earnings for a Lagos Host</span>
              </div>
              <p className="text-navy-300 max-w-2xl mx-auto text-lg leading-relaxed pt-8">
                Most Lagos SMEs spend this on petrol every month just to stay open. With T&S Power Grid, you earn it by powering them instead.
              </p>
            </FadeIn>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent opacity-50" />
        </section>

        {/* 7. The App Showcase */}
        <section id="app" className="py-24 bg-offwhite">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <FadeIn className="space-y-8">
              <h2 className="text-4xl lg:text-6xl font-display font-bold text-navy-950 leading-tight">
                Control your grid from your pocket.
              </h2>
              <div className="space-y-8">
                 {[
                   { title: "Host Dashboard", desc: "Monitor production, healthy battery status, and active sharing sessions.", icon: Smartphone },
                   { title: "Neighbor Detail", desc: "Know exactly who is using your power and for how long. Total transparency.", icon: Users },
                   { title: "Earnings Tracker", desc: "Watch your balance grow in real-time. Direct withdrawal anytime.", icon: LineChart }
                 ].map((feat, i) => (
                   <div key={i} className="flex items-start space-x-4">
                      <div className="mt-1 h-6 w-6 text-yellow-600 bg-yellow-50 rounded flex items-center justify-center shrink-0">
                        <feat.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-navy-900">{feat.title}</h4>
                        <p className="text-navy-600 text-sm">{feat.desc}</p>
                      </div>
                   </div>
                 ))}
              </div>
            </FadeIn>
            
            <FadeIn direction="left" className="relative">
              <Image 
                src="/images/app-showcase.png" 
                alt="T&S Power Grid App Screens" 
                width={700}
                height={700}
                className="w-full h-auto drop-shadow-3xl"
              />
            </FadeIn>
          </div>
        </section>

        {/* 8. For Business */}
        <section id="business" className="py-24 bg-navy-900 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <FadeIn className="space-y-4">
                <Badge variant="navy" className="bg-navy-800 text-yellow-500 border-navy-700">ENTERPRISE SOLUTIONS</Badge>
                <h2 className="text-4xl lg:text-6xl font-display font-bold">For estates, FMCGs, and telcos</h2>
              </FadeIn>
              <DialogTrigger asChild>
                <Button size="lg" variant="primary">Partner with us</Button>
              </DialogTrigger>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { title: "Water Pumping Stations", icon: Droplets, desc: "Replace expensive diesel generators for community water supply with sustainable solar clusters." },
                { title: "Estate Common Areas", icon: Building2, desc: "Reduce service charges by sharing solar energy to streetlights and common area amenities." },
                { title: "Branch Networks", icon: ShieldCheck, desc: "Ensure 100% uptime for bank branches and retail outlets using neighborhood-distributed micro-grids." }
              ].map((item, i) => (
                <FadeIn key={i} delay={i * 0.1} className="p-8 bg-navy-800 rounded-2xl border border-navy-700 hover:border-yellow-500 transition-colors">
                  <div className="h-12 w-12 rounded-xl bg-navy-700 flex items-center justify-center text-yellow-500 mb-6">
                    <item.icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-display font-bold mb-4">{item.title}</h3>
                  <p className="text-navy-400 text-sm leading-relaxed">{item.desc}</p>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* 9. CTA Band */}
        <section className="py-24 bg-yellow-500">
           <FadeIn className="mx-auto max-w-4xl px-4 text-center space-y-8">
              <h2 className="text-4xl lg:text-6xl font-display font-bold text-navy-950">
                Ready to be your own NEPA?
              </h2>
              <p className="text-xl text-navy-900/80 font-sans max-w-2xl mx-auto">
                We are currently onboarding 50 pilot hosts across Lekki, Victoria Island, and Ikeja. Secure your spot in the energy revolution.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                 <DialogTrigger asChild>
                   <Button size="lg" className="h-14 px-10 bg-navy-900 text-white hover:bg-navy-950 font-bold">
                      Book consultation
                   </Button>
                 </DialogTrigger>
                 <Button size="lg" variant="secondary" className="h-14 px-10 border-navy-950 text-navy-950 hover:bg-navy-950/5 font-bold">
                    Download pitch deck
                 </Button>
              </div>
           </FadeIn>
        </section>

        {/* 10. Footer */}
        <footer className="bg-navy-950 text-white pt-24 pb-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-24">
                <div className="space-y-6">
                  <Link href="/" className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-lg bg-yellow-500 flex items-center justify-center">
                      <div className="h-4 w-4 rounded-sm bg-navy-950" />
                    </div>
                    <span className="font-display text-2xl font-bold tracking-tight">T&S Power Grid</span>
                  </Link>
                  <p className="text-navy-400 text-sm font-sans leading-relaxed">
                    Building the infrastructure for decentralized energy in Africa. Start sharing, start earning.
                  </p>
                </div>
                
                <div>
                  <h5 className="font-bold mb-6 text-sm uppercase tracking-widest text-navy-500">Product</h5>
                  <ul className="space-y-4 text-navy-300 text-sm">
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Become a Host</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Join as Neighbor</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">The Host App</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Compatibility Check</Link></li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold mb-6 text-sm uppercase tracking-widest text-navy-500">Company</h5>
                  <ul className="space-y-4 text-navy-300 text-sm">
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">About Us</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Lagos Pilot</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Careers</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Contact</Link></li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold mb-6 text-sm uppercase tracking-widest text-navy-500">Resources</h5>
                  <ul className="space-y-4 text-navy-300 text-sm">
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Safety FAQ</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Solar Math</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Regulatory Status</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Privacy Policy</Link></li>
                  </ul>
                </div>
             </div>
             
             <div className="pt-12 border-t border-navy-800 flex flex-col md:flex-row justify-between items-center gap-4 text-navy-500 text-xs font-medium uppercase tracking-widest">
                <span>© 2026 T&S Power Grid Limited</span>
                <span className="text-navy-400">Made in Lagos, for Lagos</span>
                <div className="flex space-x-6">
                   <Link href="#" className="hover:text-yellow-500 transition-colors text-lg">𝕏</Link>
                   <Link href="#" className="hover:text-yellow-500 transition-colors text-lg">in</Link>
                </div>
             </div>
          </div>
        </footer>
      </main>
    </div>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-3xl font-display">Book Grid Consultation</DialogTitle>
          <DialogDescription className="text-base">
            Fill in your details below. Our specialists will audit your site and estimate your monthly earnings.
          </DialogDescription>
        </DialogHeader>
        <LeadForm onSuccess={() => setIsModalOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
