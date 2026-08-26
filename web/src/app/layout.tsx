import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-store";
import AppShell from "@/components/layout/AppShell";
import { I18nProvider } from "@/i18n";
import ptBR from "@/i18n/pt-BR.json";

const inter = Inter({
  variable: "--font-archia-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-archia-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Archia — Editor de Design de Sistemas",
  description: "Desenhe arquiteturas e receba avaliação de um arquiteto virtual.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0b1220",
  appleWebApp: {
    capable: true,
    title: "Archia",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Desenhe arquiteturas e receba avaliação de um arquiteto virtual." />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('archia-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.classList.add('archia-'+t);}catch(e){document.documentElement.classList.add('archia-dark');}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}`,
          }}
        />
      </head>
      <body className="h-full min-h-0 font-sans" suppressHydrationWarning>
        <I18nProvider translations={ptBR}>
          <ThemeProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:rounded focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-[var(--accent-fg)]"
            >
              Pular para conteúdo principal
            </a>
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
