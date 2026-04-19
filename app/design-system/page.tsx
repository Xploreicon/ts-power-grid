"use client";

import React from "react";
import { 
  Button, 
  Badge, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter,
  StatCard,
  Avatar,
  Input,
  Skeleton,
  EmptyState,
  toast,
  Nav,
  BottomNav,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui";
import { 
  Plus, 
  Zap, 
  CheckCircle2, 
  Wallet, 
  Mail
} from "lucide-react";

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-offwhite pb-24 md:pb-0">
      <Nav 
        links={[
          { label: "Home", href: "#" },
          { label: "Components", href: "#" },
          { label: "Documentation", href: "#" },
        ]} 
      />
      
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-20">
        <header className="space-y-4 border-b border-navy-100 pb-8">
          <h1 className="text-5xl font-display font-bold text-navy-900 tracking-tight">
            T&S Design System
          </h1>
          <p className="text-xl text-navy-600 font-sans max-w-2xl">
            Utility-grade trust meets entrepreneurial empowerment. A premium foundation for Nigeria&apos;s peer-to-peer power grid.
          </p>
        </header>

        {/* Buttons Section */}
        <section className="space-y-6">
          <h2 className="text-3xl font-display font-bold text-navy-900">Buttons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Variants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="primary" className="w-full">Primary Action</Button>
                <Button variant="secondary" className="w-full">Secondary Action</Button>
                <Button variant="ghost" className="w-full">Ghost Action</Button>
                <Button variant="danger" className="w-full">Danger Action</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sizes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button size="lg" className="w-full">Large Button</Button>
                <Button size="md" className="w-full">Medium Button</Button>
                <Button size="sm" className="w-full">Small Button</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">States</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button loading className="w-full">Loading State</Button>
                <Button disabled className="w-full">Disabled State</Button>
                <Button variant="primary" leftIcon={<Zap className="h-4 w-4" />} className="w-full">
                  With Left Icon
                </Button>
                <Button variant="secondary" rightIcon={<Plus className="h-4 w-4" />} className="w-full">
                  With Right Icon
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Badges Section */}
        <section className="space-y-6">
          <h2 className="text-3xl font-display font-bold text-navy-900">Badges</h2>
          <div className="flex flex-wrap gap-4">
            <Badge variant="default">Default</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="yellow">Yellow Accent</Badge>
            <Badge variant="navy">Navy Accent</Badge>
            <Badge variant="success" dot pulse>Live Status</Badge>
            <Badge variant="danger" dot>Offline</Badge>
          </div>
        </section>

        {/* Stats Section */}
        <section className="space-y-6">
          <h2 className="text-3xl font-display font-bold text-navy-900">Stat Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              label="Active Neighbors" 
              value="1,248" 
              trend={{ value: 12.5, isUp: true }}
            />
            <StatCard 
              variant="dark"
              label="Total Revenue" 
              value="₦842,000" 
              trend={{ value: 8.2, isUp: true }}
              useMono
            />
            <StatCard 
              variant="highlight"
              label="Grid Uptime" 
              value="99.9%" 
              trend={{ value: 0.1, isUp: false }}
            />
          </div>
        </section>

        {/* Cards Section */}
        <section className="space-y-6">
          <h2 className="text-3xl font-display font-bold text-navy-900">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Utility Grade</CardTitle>
                <CardDescription>Default card style for basic content.</CardDescription>
              </CardHeader>
              <CardContent>
                Transparency and reliability are core to T&S Power Grid.
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm">Learn More</Button>
              </CardFooter>
            </Card>
            
            <Card variant="elevated" interactive>
              <CardHeader>
                <CardTitle>Interactive Lift</CardTitle>
                <CardDescription>Hover over me to see the elevation effect.</CardDescription>
              </CardHeader>
              <CardContent>
                Premium feel with subtle animations for entrepreneurial empowerment.
              </CardContent>
            </Card>

            <Card variant="dark">
              <CardHeader>
                <CardTitle>Dark Theme</CardTitle>
                <CardDescription className="text-navy-300">Strict infrastructure aesthetic.</CardDescription>
              </CardHeader>
              <CardContent>
                Used for administrative dashboards and higher-tier host controls.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Inputs & Form Section */}
        <section className="space-y-6">
          <h2 className="text-3xl font-display font-bold text-navy-900">Form Inputs</h2>
          <div className="max-w-xl space-y-6">
            <Input 
              label="Full Name" 
              placeholder="Divine Ajie" 
              hint="As it appears on your ID"
            />
            <Input 
              label="Phone Number" 
              placeholder="812 345 6789" 
              prefix="+234"
              type="tel"
            />
            <Input 
              label="Estimated Sales" 
              placeholder="50,000" 
              prefix="₦"
              hint="Weekly average"
            />
            <Input 
              label="Email Address" 
              placeholder="hello@tspower.ng" 
              leftIcon={<Mail className="h-4 w-4" />}
              rightIcon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
            />
            <Input 
              label="Password" 
              type="password"
              placeholder="••••••••"
              error="Password must be at least 8 characters"
            />
          </div>
        </section>

        {/* Avatars & Feedback */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <h2 className="text-3xl font-display font-bold text-navy-900">Avatars</h2>
            <div className="flex items-end gap-6">
              <Avatar size="lg" initials="DA" status="online" />
              <Avatar size="md" initials="SK" status="idle" />
              <Avatar size="sm" initials="JD" status="offline" />
              <Avatar size="xs" initials="AA" />
            </div>
            <div className="flex items-end gap-6 pt-4">
               <Avatar size="lg" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop" />
               <Skeleton className="h-16 w-16 rounded-full" />
               <Skeleton className="h-4 w-32" />
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-display font-bold text-navy-900">Feedback</h2>
            <div className="flex flex-wrap gap-4">
              <Button variant="secondary" onClick={() => toast.success("Power restored to Grid #402")}>
                Success Toast
              </Button>
              <Button variant="secondary" onClick={() => toast.error("Connection lost", "Check your local meter status")}>
                Error Toast
              </Button>
              <Button variant="secondary" onClick={() => toast.warning("Low balance warning")}>
                Warning Toast
              </Button>
            </div>
            <div className="pt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="primary">Open Sample Modal</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Power Sharing</DialogTitle>
                    <DialogDescription>
                      You are about to share 50kWh with your neighbor at Grid #102. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 font-sans text-sm text-navy-700">
                    Your estimated earnings for this transaction: <span className="font-bold text-green-600">₦2,500</span>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button variant="primary" onClick={() => toast.success("Transaction Complete")}>
                      Confirm & Share
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>

        {/* Empty States */}
        <section className="space-y-6">
          <h2 className="text-3xl font-display font-bold text-navy-900">Empty States</h2>
          <Card className="border-dashed border-2">
            <EmptyState 
              icon={Wallet}
              title="No transactions yet"
              description="Start sharing power with your community to see your earnings grow here."
              action={{
                label: "Find Neighbors",
                onClick: () => {}
              }}
            />
          </Card>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
