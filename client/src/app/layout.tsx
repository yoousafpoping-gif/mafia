import type { Metadata } from "next";
import { Cairo, Geist_Mono } from "next/font/google";
import { AudioProvider } from "@/context/AudioContext";
import { AuthProvider } from "@/context/AuthContext";
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
  title: 'حارة المافيا - لعبة الشك والغموض',
  description:
    'حارة المافيا — لعبة مافيا أونلاين بالوقت الحقيقي: زعيم المافيا، ساكت الأهالي، العمدة، الولد الطيب، الدكتور والقناص.',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <AuthProvider>
          <AudioProvider>{children}</AudioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
