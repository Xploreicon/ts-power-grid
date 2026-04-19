"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

interface NavLink {
  label: string;
  href: string;
}

interface NavProps extends React.HTMLAttributes<HTMLElement> {
  links: NavLink[];
}

function Nav({ className, links, ...props }: NavProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 w-full border-b border-navy-100 bg-white/80 backdrop-blur-md",
        className
      )}
      {...props}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-navy-950 flex items-center justify-center">
            <div className="h-4 w-4 rounded-sm bg-yellow-500" />
          </div>
          <span className="font-display text-xl font-bold text-navy-950">T&S Power</span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex md:items-center md:space-x-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-navy-700 hover:text-navy-950 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex md:items-center md:space-x-4">
          <Button variant="ghost" size="sm">Log in</Button>
          <Button variant="primary" size="sm">Get Started</Button>
        </div>

        {/* Mobile Toggle */}
        <div className="flex md:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-navy-900 focus:outline-none"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-navy-100 bg-white p-4 space-y-4 animate-in slide-in-from-top duration-200">
          <div className="space-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="block px-3 py-2 text-base font-medium text-navy-700 hover:bg-navy-50 rounded-lg"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col space-y-2 pt-2 border-t border-navy-100">
            <Button variant="ghost" className="w-full justify-start">Log in</Button>
            <Button variant="primary" className="w-full">Get Started</Button>
          </div>
        </div>
      )}
    </nav>
  );
}

export { Nav };
