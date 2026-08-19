import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Archia — Editor de System Design",
  description: "Desenhe arquiteturas e receba avaliação de um arquiteto virtual.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Desenhe arquiteturas e receba avaliação de um arquiteto virtual." />
      </head>
      <body className="h-full min-h-0 bg-[#070b10] font-sans text-slate-100" suppressHydrationWarning>
        {/* P3.3.3 — Skip link for keyboard navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-white"
        >
          Pular para conteúdo principal
        </a>
        <main id="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
