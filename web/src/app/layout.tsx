import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GoogleAuthProvider } from "@/components/auth/GoogleAuthProvider";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

export const metadata: Metadata = {
  title: {
    default: "WellNote (beta) — We will note!",
    template: "%s · WellNote (beta)",
  },
  description: "We will note! — 매일 한 페이지, 봉인되는 일기.",
  applicationName: "WellNote (beta)",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "WellNote (beta) — We will note!",
    description: "매일 한 페이지, 봉인되는 일기.",
    siteName: "WellNote",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider>
            <GoogleAuthProvider>{children}</GoogleAuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
