import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/shell/theme-provider";

export const metadata: Metadata = {
  title: "WellNote",
  description: "매일 한 페이지, 봉인되는 일기.",
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
