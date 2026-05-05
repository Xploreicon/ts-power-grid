"use client";

import React, { Suspense } from "react";
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
  LineChart,
  Sun,
  Zap,
  ArrowRight,
  Plus,
} from "lucide-react";
import {
  Button,
  Badge,
  Nav,
} from "@/components/ui";
import { Marquee } from "@/components/marketing/marquee";
import { FadeIn } from "@/components/marketing/fade-in";

export default function MarketingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-offwhite" />}>
      <MarketingPageContent />
    </Suspense>
  );
}

function MarketingPageContent() {
  return (
    <div className="min-h-screen bg-offwhite selection:bg-yellow-200">
      {/* 1. Navigation */}
      <Nav
        links={[
          { label: "How it works", href: "#how-it-works" },
          { label: "Packages", href: "#packages" },
          { label: "The App", href: "#app" },
          { label: "For Business", href: "#business" },
        ]}
        className="fixed border-b-navy-100/50"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link href="/waitlist">Join waitlist</Link>
            </Button>
          </div>
        }
        mobileActions={
          <div className="flex flex-col gap-2 w-full">
            <Button asChild variant="secondary" className="w-full">
              <Link href="/sign-in">Sign in / Create account</Link>
            </Button>
            <Button asChild variant="primary" className="w-full">
              <Link href="/waitlist">Join waitlist</Link>
            </Button>
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
                  Lagos pilot — 50 slots only
                </Badge>
                <h1 className="text-5xl lg:text-7xl font-display font-bold text-navy-950 leading-[1.1] tracking-tight">
                  Be your own <span className="italic bg-yellow-500 text-navy-950 px-3 rounded-lg">NEPA.</span> <br />
                  <span className="text-navy-900">Sell power to your neighbors.</span>
                </h1>
                <p className="text-xl text-navy-700 font-sans max-w-lg leading-relaxed">
                  T&S Power Grid turns your Excess Solar capacity into a reliable monthly income. Join Nigeria&apos;s first peer-to-peer micro-utility network.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button asChild size="lg" className="h-14 px-8 text-lg font-bold shadow-lg shadow-yellow-500/20">
                    <Link href="/waitlist">
                      Join the waitlist
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg" className="h-14 px-8 text-lg font-bold">
                    <a href="#packages">See the packages</a>
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
              <span className="text-sm font-bold tracking-widest text-navy-900 uppercase">HOW IT WORKS</span>
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
                    <span className="font-mono text-4xl font-bold text-navy-950/30 group-hover:text-navy-950/70 transition-colors">
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

        {/* 5. Packages (replaces Two Paths) */}
        <section id="packages" className="py-24 bg-white overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
            <FadeIn className="text-center space-y-4">
              <span className="text-sm font-bold tracking-widest text-navy-900 uppercase">PACKAGES</span>
              <h2 className="text-4xl lg:text-6xl font-display font-bold text-navy-950">Choose your path to income</h2>
              <p className="text-navy-600 font-sans max-w-2xl mx-auto">
                Whether you have existing solar or starting fresh, there&apos;s a package that fits your situation and budget.
              </p>
            </FadeIn>

            {/* Primary 3 packages — 1-column stack for max readability */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Package 1: IBPMN */}
              <FadeIn className="bg-white rounded-[32px] border-2 border-navy-100 p-8 flex flex-col justify-between hover:border-yellow-500 transition-colors group">
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <Badge className="bg-navy-50 text-navy-700 border-navy-100 text-[10px] uppercase tracking-widest font-bold">
                      Lowest entry · Fastest install
                    </Badge>
                  </div>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-yellow-50 flex items-center justify-center flex-shrink-0 group-hover:bg-yellow-500 transition-colors">
                      <Sun className="h-6 w-6 text-yellow-600 group-hover:text-navy-950 transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-display font-bold text-navy-950">&ldquo;I Better Pass My Neighbour&rdquo;</h3>
                      <p className="text-navy-500 text-sm font-sans mt-1">For 9-to-5ers with small solar (1-3kW)</p>
                    </div>
                  </div>
                  <p className="text-navy-700 font-sans text-sm leading-relaxed mb-6 italic">
                    &ldquo;Your solar dey work while you dey office. Make e work for your pocket too.&rdquo;
                  </p>
                  <ul className="space-y-3 mb-6">
                    {["Gateway hub", "1-2 smart sub-meters", "Wiring & installation", "Platform access", "WhatsApp billing"].map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-navy-700">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-mono text-3xl font-bold text-navy-950">₦350K</span>
                    <span className="text-xs text-navy-400 font-bold uppercase tracking-wider">starting</span>
                  </div>
                  <p className="text-xs text-green-600 font-mono font-bold mb-6">
                    Earn ₦20K – ₦50K/month · 1-2 neighbors
                  </p>
                </div>
                <Button asChild className="w-full h-12 font-bold">
                  <Link href="/waitlist">
                    Join waitlist
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </FadeIn>

              {/* Package 2: Oga Light (Most Popular) */}
              <FadeIn delay={0.1} className="bg-yellow-500 rounded-[32px] p-8 flex flex-col justify-between relative overflow-hidden">
                <Badge className="absolute top-6 right-6 bg-navy-900 text-yellow-500 uppercase font-bold tracking-tighter text-xs">
                  Most popular
                </Badge>
                <div>
                  <div className="flex items-start gap-4 mb-4 mt-2">
                    <div className="h-12 w-12 rounded-2xl bg-navy-900/10 flex items-center justify-center flex-shrink-0">
                      <Zap className="h-6 w-6 text-navy-950" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-display font-bold text-navy-950">&ldquo;Oga Light&rdquo;</h3>
                      <p className="text-navy-950/70 text-sm font-sans mt-1">Upgrade Kit · Existing solar 3-5kW+</p>
                    </div>
                  </div>
                  <p className="text-navy-950/80 font-sans text-sm leading-relaxed mb-6 italic">
                    &ldquo;You already get the power. Now get the platform to sell am properly.&rdquo;
                  </p>
                  <ul className="space-y-3 mb-6">
                    {["Gateway hub", "3 smart sub-meters (expandable)", "Wiring & integration", "Full host dashboard", "Neighbor onboarding support"].map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-navy-950">
                        <CheckCircle2 className="h-4 w-4 text-navy-900 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-mono text-3xl font-bold text-navy-950">₦800K</span>
                    <span className="text-xs text-navy-950/60 font-bold uppercase tracking-wider">starting</span>
                  </div>
                  <p className="text-xs text-navy-900 font-mono font-bold mb-6">
                    Earn ₦80K – ₦150K/month · 3-5 neighbors
                  </p>
                </div>
                <Button asChild className="w-full h-12 bg-navy-900 text-white hover:bg-navy-950 font-bold">
                  <Link href="/waitlist">
                    Join waitlist
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </FadeIn>

              {/* Package 3: Landlord Special */}
              <FadeIn delay={0.2} className="bg-navy-900 rounded-[32px] p-8 text-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-[10px] uppercase tracking-widest font-bold">
                      Highest earning potential
                    </Badge>
                  </div>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-6 w-6 text-yellow-500" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-display font-bold">&ldquo;Landlord Special&rdquo;</h3>
                      <p className="text-white/60 text-sm font-sans mt-1">Full Stack · No solar needed</p>
                    </div>
                  </div>
                  <p className="text-white/70 font-sans text-sm leading-relaxed mb-6 italic">
                    &ldquo;Your compound dey spend ₦500K every month on gen. You fit collect that money instead.&rdquo;
                  </p>
                  <ul className="space-y-3 mb-4">
                    {["Complete solar system install", "Gateway hub + smart meters", "Full platform & dashboard", "Neighbor demand validation", "3-month installment option"].map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-white/90">
                        <CheckCircle2 className="h-4 w-4 text-yellow-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="bg-navy-800 rounded-xl p-3 mb-4">
                    <p className="text-xs text-yellow-500/80 font-sans">
                      <span className="font-bold text-yellow-500">Demand-validated:</span> We survey your neighbors first — you only commit when the numbers make sense.
                    </p>
                  </div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-mono text-3xl font-bold">₦5.5M</span>
                    <span className="text-xs text-white/50 font-bold uppercase tracking-wider">3-mo installment</span>
                  </div>
                  <p className="text-xs text-yellow-500 font-mono font-bold mb-6">
                    Earn ₦120K – ₦200K/month · 5+ neighbors
                  </p>
                </div>
                <Button asChild className="w-full h-12 bg-yellow-500 text-navy-950 hover:bg-yellow-400 font-bold">
                  <Link href="/waitlist">
                    Join waitlist
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </FadeIn>
            </div>

            {/* Package 4: Area Oga (compact) */}
            <FadeIn delay={0.3}>
              <div className="bg-navy-50 rounded-2xl border border-navy-100 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8">
                <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 border border-navy-100">
                  <Plus className="h-6 w-6 text-navy-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-display font-bold text-lg text-navy-950">&ldquo;Area Oga&rdquo;</h3>
                    <Badge className="bg-navy-100 text-navy-600 border-navy-200 text-[10px] uppercase tracking-widest font-bold">
                      For existing hosts
                    </Badge>
                  </div>
                  <p className="text-navy-600 text-sm font-sans">
                    Your grid dey grow. We dey grow with you. Add more meters, neighbors, or capacity with modular pricing.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm" className="flex-shrink-0">
                  <Link href="/waitlist">Learn more</Link>
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* 6. Big Stat */}
        <section className="py-32 bg-navy-950 text-center relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
            <FadeIn className="space-y-6">
              <h2 className="text-white/70 text-sm font-bold tracking-widest uppercase">THE OPPORTUNITY</h2>
              <div className="space-y-4">
                <span className="text-[10vw] font-display font-bold leading-none text-yellow-500 block">₦180,000</span>
                <p className="text-white/70 max-w-3xl mx-auto text-xl lg:text-2xl leading-relaxed font-medium">
                  With petrol at over <strong className="text-white">₦1,200/litre</strong>, a 5kVA generator burns <strong className="text-white">₦150K–₦250K monthly</strong>. Your neighbors are already spending this. With T&S, they pay <strong className="text-[#FFB800]">YOU</strong> instead.
                </p>
              </div>
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
              <Button asChild size="lg" variant="primary">
                <Link href="/waitlist">Partner with us</Link>
              </Button>
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
                  <p className="text-white/70 text-sm leading-relaxed">{item.desc}</p>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* 9. CTA Band */}
        <section className="py-24 bg-yellow-500">
           <FadeIn className="mx-auto max-w-4xl px-4 text-center space-y-8">
              <h2 className="text-4xl lg:text-6xl font-display font-bold text-navy-950">
                50 pilot slots. Lagos only. First come, first served.
              </h2>
              <p className="text-xl text-navy-950/80 font-sans max-w-2xl mx-auto">
                Join the waitlist. We&apos;ll survey your site, confirm your package, and lock in your install date.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                 <Button asChild size="lg" className="h-14 px-10 bg-navy-900 text-white hover:bg-navy-950 font-bold">
                   <Link href="/waitlist">
                     Join the waitlist
                     <ArrowRight className="h-5 w-5 ml-2" />
                   </Link>
                 </Button>
                 <Button size="lg" variant="secondary" className="h-14 px-10 border-navy-950 text-navy-950 hover:bg-navy-950/5 font-bold">
                    Download pitch deck
                 </Button>
              </div>
              <p className="text-sm text-navy-950/60 font-sans">
                Already have solar? You could be live within 2 weeks of your survey.
              </p>
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
                  <p className="text-white/70 text-sm font-sans leading-relaxed">
                    Building the infrastructure for decentralized energy in Africa. Start sharing, start earning.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold mb-6 text-sm uppercase tracking-widest text-white/80">Product</h5>
                  <ul className="space-y-4 text-white/70 text-sm">
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Become a Host</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Join as Neighbor</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">The Host App</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Compatibility Check</Link></li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold mb-6 text-sm uppercase tracking-widest text-white/80">Company</h5>
                  <ul className="space-y-4 text-white/70 text-sm">
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">About Us</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Lagos Pilot</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Careers</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Contact</Link></li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold mb-6 text-sm uppercase tracking-widest text-white/80">Resources</h5>
                  <ul className="space-y-4 text-white/70 text-sm">
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Safety FAQ</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Solar Math</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Regulatory Status</Link></li>
                    <li><Link href="#" className="hover:text-yellow-500 transition-colors">Privacy Policy</Link></li>
                  </ul>
                </div>
             </div>

             <div className="pt-12 border-t border-navy-800 flex flex-col md:flex-row justify-between items-center gap-4 text-white/70 text-xs font-medium uppercase tracking-widest">
                <span>© 2026 T&S Power Grid Limited</span>
                <span className="text-white/70">Made in Lagos, for Lagos</span>
                <div className="flex space-x-6">
                   <Link href="#" className="hover:text-yellow-500 transition-colors text-lg">𝕏</Link>
                   <Link href="#" className="hover:text-yellow-500 transition-colors text-lg">in</Link>
                </div>
             </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
