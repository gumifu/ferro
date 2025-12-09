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
  title: "ferro",
  description:
    "Ferro is a floating ferrofluid-inspired sculpture that reacts to sound and motion. A calm companion for your workspace, creating gentle, organic visuals shaped by music and interaction.",
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
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
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
