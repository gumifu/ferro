import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ferro-kappa.vercel.app"),
  title: "ferro | Interactive Sound Visualizer",
  icons: {
    icon: [
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    title: "Ferro",
  },
  manifest: "/site.webmanifest",
  description:
    "An interactive ferrofluid-inspired sound visualizer that floats, reacts to music and motion, and creates calm, organic visuals that feel alive.",
  keywords: [
    "ferrofluid",
    "audio visualization",
    "3D visualization",
    "interactive art",
    "WebGL",
    "Three.js",
    "music visualization",
  ],
  authors: [{ name: "ferro" }],
  creator: "ferro",
  publisher: "ferro",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ferro-kappa.vercel.app",
    siteName: "ferro",
    title: "ferro",
    description:
      "Ferro is a floating ferrofluid-inspired sculpture that reacts to sound and motion. A calm companion for your workspace, creating gentle, organic visuals shaped by music and interaction.",
    images: [
      {
        url: "/ferro_OGP.png",
        width: 1200,
        height: 630,
        alt: "ferro - Interactive 3D Audio Visualization",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ferro",
    description:
      "Ferro is a floating ferrofluid-inspired sculpture that reacts to sound and motion. A calm companion for your workspace, creating gentle, organic visuals shaped by music and interaction.",
    images: ["/ferro_OGP.png"],
    creator: "@ferrofluid",
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
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
