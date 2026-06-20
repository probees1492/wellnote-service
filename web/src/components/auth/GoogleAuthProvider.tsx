"use client";

import type { ReactNode } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

/**
 * Reads the public Google client ID at build time. When the value is missing
 * we still render an inert provider so downstream components can detect the
 * missing config and render a graceful fallback.
 */
export const GOOGLE_CLIENT_ID: string =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  // @react-oauth/google requires a non-empty client ID; if it's missing, skip
  // the provider entirely. The GoogleSignInButton component below detects
  // this case and renders a disabled button with an explanatory tooltip.
  if (!GOOGLE_CLIENT_ID) {
    return <>{children}</>;
  }
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {children}
    </GoogleOAuthProvider>
  );
}
