import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Easeboard - Next-Generation Canvas LMS Dashboard",
  description: "A modern, AI-powered learning management system built with Next.js 15, Supabase, and cutting-edge technologies. Transform your academic journey with smart analytics, real-time insights, and comprehensive learning tools.",
  keywords: [
    "Canvas LMS",
    "Learning Management System", 
    "Education Dashboard",
    "Student Portal",
    "Academic Analytics",
    "Next.js",
    "React",
    "TypeScript",
    "Supabase",
    "PWA"
  ],
  authors: [{ name: "Easeboard Team" }],
  creator: "Easeboard",
  publisher: "Easeboard",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://easeboard.app"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192x192.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://easeboard.app",
    title: "Easeboard - Next-Generation Canvas LMS Dashboard",
    description: "Transform your academic journey with AI-powered insights, smart analytics, and comprehensive learning management tools.",
    siteName: "Easeboard",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Easeboard - Modern Learning Management System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Easeboard - Next-Generation Canvas LMS Dashboard", 
    description: "Transform your academic journey with AI-powered insights and smart analytics.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Easeboard",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#2563eb",
    "msapplication-tap-highlight": "no",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background font-sans`}
        suppressHydrationWarning
      >
        <Providers>
          {children}
          <Toaster 
            position="top-right"
            expand={true}
            richColors={true}
            closeButton={true}
          />
        </Providers>
      </body>
    </html>
  );
}
