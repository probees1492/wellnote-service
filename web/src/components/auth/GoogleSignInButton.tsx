"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { GOOGLE_CLIENT_ID } from "./GoogleAuthProvider";

interface Props {
  /** Whether to keep the session persistently (localStorage). */
  remember: boolean;
  /** Called after successful sign-in to navigate away (e.g. router.push). */
  onSuccess?: () => void;
  /** Visual hint: "signin_with" on /login, "signup_with" on /signup. */
  text?: "signin_with" | "signup_with" | "continue_with";
  /** Optional dataset hook for E2E tests. */
  testId?: string;
}

/**
 * Renders Google's standard "Sign in with Google" button. When the public
 * client ID is missing we render a disabled shadcn Button with an explanatory
 * title so the rest of the auth surface still works in environments where
 * Google sign-in hasn't been configured yet.
 */
export function GoogleSignInButton({
  remember,
  onSuccess,
  text = "signin_with",
  testId = "google-signin",
}: Props) {
  const loginWithGoogle = useAuth((s) => s.loginWithGoogle);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSuccess = useCallback(
    async (credentialResponse: CredentialResponse) => {
      setError(null);
      const idToken = credentialResponse.credential;
      if (!idToken) {
        setError("Google 응답에 id_token이 없습니다.");
        return;
      }
      setBusy(true);
      try {
        await loginWithGoogle(idToken, { remember });
        onSuccess?.();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Google 로그인에 실패했습니다.";
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [loginWithGoogle, onSuccess, remember],
  );

  // Fallback when no client ID is configured: render an outline button that
  // explains the situation on click instead of attempting an OAuth flow.
  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="flex flex-col gap-2" data-testid={`${testId}-fallback`}>
        <Button
          variant="outline"
          type="button"
          disabled
          title="Google 로그인 설정이 필요합니다 (NEXT_PUBLIC_GOOGLE_CLIENT_ID)"
          aria-label="Google로 계속하기 (설정 필요)"
        >
          <GoogleLogoSvg />
          Google로 계속하기 (설정 필요)
        </Button>
        <span className="text-xs text-muted-foreground">
          Google 로그인 설정이 필요합니다.
        </span>
      </div>
    );
  }

  // The Google Sign-In widget renders only after mount (next-themes is
  // client-side). The wrapper styles approximate our outline-button look.
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div
        className="flex w-full justify-center"
        // Force re-mount when theme flips so the inner Google iframe matches.
        key={resolvedTheme ?? "light"}
        aria-busy={busy}
      >
        {mounted ? (
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => setError("Google 로그인에 실패했습니다.")}
            useOneTap={false}
            text={text}
            shape="rectangular"
            size="large"
            theme={resolvedTheme === "dark" ? "filled_black" : "outline"}
            width="320"
            logo_alignment="left"
          />
        ) : (
          <div className="h-10 w-full max-w-[320px] rounded-md border border-input bg-background" />
        )}
      </div>
      {error ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid={`${testId}-error`}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

function GoogleLogoSvg() {
  // Official multicolor "G" mark, simplified.
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.6154z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8595-3.0477.8595-2.344 0-4.3282-1.5832-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1736 0 7.5477 0 9c0 1.4523.3477 2.8264.9573 4.0418L3.964 10.71z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
        fill="#EA4335"
      />
    </svg>
  );
}
