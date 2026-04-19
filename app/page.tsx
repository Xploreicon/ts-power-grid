"use client";

import React, { useState, Suspense } from "react";
import Image from "next/image";
import { 
  Users, 
  Cpu,
  Wallet
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
import { LeadForm } from "@/components/marketing/lead-form";

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
    <div className="min-h-screen bg-offwhite selection:bg-yellow-200">
      <Nav 
        links={[
          { label: "How it works", href: "#how-it-works" },
          { label: "Paths", href: "#paths" },
          { label: "The App", href: "#app" },
          { label: "For Business", href: "#business" },
        ]}
        className="fixed border-b-navy-100/50"
      />

      <main>
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <Badge variant="success" dot pulse className="py-1 px-4 text-sm font-bold bg-green-50">
                  Now onboarding Lagos pilot hosts
                </Badge>
                <h1 className="text-5xl lg:text-7xl font-display font-bold text-navy-950 leading-[1.1] tracking-tight">
                  Be your own NEPA. <br />
                  <span className="text-navy-900">Sell power to your </span>
                  <span className="italic text-yellow-500">neighbors.</span>
                </h1>
                <p className="text-xl text-navy-700 font-sans max-w-lg leading-relaxed">
                  T&S Power Grid turns your Excess Solar capacity into a reliable monthly income. Join Nigeria&apos;s first peer-to-peer micro-utility network.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                      <Button size="lg" className="h-14 px-8 text-lg font-bold shadow-lg shadow-yellow-500/20">
                        Become a host
                      </Button>
                    </DialogTrigger>
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
                  <Button variant="secondary" size="lg" className="h-14 px-8 text-lg font-bold">
                    See how it works
                  </Button>
                </div>
              </div>

              <div className="relative lg:ml-auto">
                <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
                  <Image 
                    src="/images/hero-dashboard.png" 
                    alt="T&S Power Grid Dashboard" 
                    width={600} 
                    height={600}
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-24 bg-paper/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-16">
            <h2 className="text-4xl lg:text-6xl font-display font-bold text-navy-950">
              Solar you own. Power you sell.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {[
                { 
                  step: "01", 
                  title: "Install or Upgrade", 
                  desc: "Choose a full stack or use our upgrade kit for your existing solar.",
                  icon: Cpu
                },
                { 
                  step: "02", 
                  title: "Invite Neighbors", 
                  desc: "Neighbors within 200m join via the app.",
                  icon: Users
                },
                { 
                  step: "03", 
                  title: "Earn Automatically", 
                  desc: "As neighbors consume power, your wallet grows in real-time.",
                  icon: Wallet
                }
              ].map((item, idx) => (
                <div key={idx} className="p-8 bg-white rounded-2xl border border-navy-100">
                  <h3 className="text-2xl font-display font-bold text-navy-900 mb-4">{item.title}</h3>
                  <p className="text-navy-600 font-sans">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 bg-navy-950 text-white">
           <div className="mx-auto max-w-7xl px-4 text-center">
              <h2 className="text-4xl font-display font-bold">₦180,000 / month</h2>
              <p className="text-navy-300">Average monthly earnings for a Lagos Host</p>
           </div>
        </section>

        <footer className="bg-navy-950 text-white py-12">
          <div className="mx-auto max-w-7xl px-4 text-center">
             <p>© 2026 T&S Power Grid. Made in Lagos.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
