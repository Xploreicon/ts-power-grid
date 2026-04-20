import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Substituting General Sans with Plus Jakarta Sans as a high-quality alternative
// available via next/font/google for zero-config project scaffolding.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-general-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "T&S Power Grid",
  description: "Peer-to-peer power sharing platform for Nigeria",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "T&S Power Grid",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "T&S Power Grid",
    title: "T&S Power Grid",
    description: "Empowering communities through peer-to-peer power sharing.",
  },
  twitter: {
    card: "summary_large_image",
    title: "T&S Power Grid",
    description: "Empowering communities through peer-to-peer power sharing.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A2540",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${jakarta.variable} ${jetbrainsMono.variable} font-sans bg-offwhite text-navy-900 antialiased`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster position="top-center" richColors />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});})}`,
          }}
        />
      </body>
    </html>
  );
}
