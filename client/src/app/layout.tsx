import type { Metadata } from "next";
import { Cairo, Geist_Mono } from "next/font/google";
import { AudioProvider } from "@/context/AudioContext";
import { AuthProvider } from "@/context/AuthContext";
import { AuthGate } from "@/components/AuthGate";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://mafia-b1d7e.web.app/'),
  title: 'حارة المافيا | 2D',
  description:
    'ادخل الحارة واكتشف مين المافيا قبل ما يخلصوا عليك! العب الآن مع أصحابك مجاناً.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: 'حارة المافيا - اللعبة الأصلية',
    description:
      'ادخل الحارة واكتشف مين المافيا قبل ما يخلصوا عليك! العب الآن مع أصحابك مجاناً.',
    url: 'https://mafia-b1d7e.web.app/',
    siteName: 'حارة المافيا | 3D',
    type: 'website',
    images: [
      {
        url: 'https://mafia-b1d7e.web.app/assets/backgrounds/og-image.jpeg',
        width: 1200,
        height: 630,
        alt: 'حارة المافيا - اللعبة الأصلية',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'حارة المافيا | 2D',
    description:
      'ادخل الحارة واكتشف مين المافيا قبل ما يخلصوا عليك! العب الآن مع أصحابك مجاناً.',
    images: ['https://mafia-b1d7e.web.app/assets/backgrounds/og-image.jpeg'],
    site: 'mafia-b1d7e.web.app',
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="font-sans">
        <AuthProvider>
          <AuthGate>
            <AudioProvider>{children}</AudioProvider>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
