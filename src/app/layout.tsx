import type { Metadata } from "next";
import { Fraunces, Manrope, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const korean = Noto_Sans_KR({
  variable: "--font-ko",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Talkaroo — Korean conversation + Learning HUD",
  description:
    "Practice everyday Korean with a live AI partner while a Learning HUD glosses useful words, suggests natural replies, and polishes what you say.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${korean.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-sans)]">
        {children}
      </body>
    </html>
  );
}
