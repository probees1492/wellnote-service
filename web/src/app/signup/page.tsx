"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { LogoWordmark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  type DisplayNameReason,
  useAuth,
  validateDisplayNameClient,
} from "@/lib/auth-store";
import { useT } from "@/lib/i18n/LocaleProvider";

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; value: string }
  | { status: "unavailable"; reason: DisplayNameReason };

export default function SignupPage() {
  const router = useRouter();
  const t = useT();
  const signup = useAuth((s) => s.signup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  const debounceRef = useRef<number | null>(null);

  const emailLocalPart = useMemo(() => {
    const at = email.indexOf("@");
    return at > 0 ? email.slice(0, at) : email;
  }, [email]);
  const displayNamePlaceholder = emailLocalPart || "예: 한필명";

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const trimmed = displayName.trim();
    if (!trimmed) {
      setCheck({ status: "idle" });
      return;
    }
    const local = validateDisplayNameClient(trimmed);
    if (!local.ok) {
      setCheck({ status: "unavailable", reason: local.reason });
      return;
    }
    setCheck({ status: "checking" });
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r = await api.checkDisplayName(local.value);
        if (r.available) {
          setCheck({ status: "available", value: local.value });
        } else {
          setCheck({
            status: "unavailable",
            reason: r.reason ?? "taken",
          });
        }
      } catch {
        // Network errors don't block submit — server-side check is authoritative.
        setCheck({ status: "idle" });
      }
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [displayName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("signup.password_short"));
      return;
    }
    if (password !== confirm) {
      setError(t("signup.password_mismatch"));
      return;
    }
    const local = validateDisplayNameClient(displayName);
    if (!local.ok) {
      setError(t(`displayname.reason.${local.reason}`));
      return;
    }
    if (check.status === "unavailable") {
      setError(t(`displayname.reason.${check.reason}`));
      return;
    }
    setLoading(true);
    try {
      await signup(email, password, local.value, { remember });
      router.push("/app");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("signup.generic_error");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const submitDisabled =
    loading ||
    check.status === "checking" ||
    check.status === "unavailable" ||
    displayName.trim().length === 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-6 py-16">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mb-2 flex justify-center">
              <LogoWordmark size="lg" />
            </div>
            <CardTitle className="text-xl">{t("signup.title")}</CardTitle>
            <CardDescription>{t("signup.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={onSubmit}
              className="flex flex-col gap-4"
              aria-label="signup-form"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{t("signup.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="signup-email"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{t("signup.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="signup-password"
                />
                <span className="text-xs text-muted-foreground">
                  {t("signup.password_hint")}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">{t("signup.confirm")}</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  data-testid="signup-confirm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="displayName">{t("signup.displayname")}</Label>
                <Input
                  id="displayName"
                  required
                  minLength={DISPLAY_NAME_MIN}
                  maxLength={DISPLAY_NAME_MAX}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={displayNamePlaceholder}
                  aria-describedby="displayName-help"
                  data-testid="signup-displayname"
                />
                <DisplayNameHelp id="displayName-help" state={check} />
              </div>

              <label
                className="flex cursor-pointer items-center gap-2 text-sm"
                htmlFor="signup-remember"
              >
                <Checkbox
                  id="signup-remember"
                  checked={remember}
                  onCheckedChange={setRemember}
                  data-testid="signup-remember"
                />
                <span className="select-none text-foreground">{t("signup.remember")}</span>
              </label>

              {error ? (
                <div
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  data-testid="signup-error"
                >
                  {error}
                </div>
              ) : null}
              <Button
                type="submit"
                size="lg"
                disabled={submitDisabled}
                data-testid="signup-submit"
              >
                {loading ? t("signup.submitting") : t("signup.submit")}
              </Button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{t("common.or")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <GoogleSignInButton
                remember={remember}
                onSuccess={() => router.push("/app")}
                text="signup_with"
                testId="google-signup"
              />
              <Button variant="outline" disabled>
                {t("signup.apple_coming")}
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("signup.have_account")}{" "}
              <Link href="/login" className="font-medium text-foreground underline">
                {t("signup.login_link")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function DisplayNameHelp({
  id,
  state,
}: {
  id: string;
  state: CheckState;
}) {
  const t = useT();
  if (state.status === "idle") {
    return (
      <span id={id} className="text-xs text-muted-foreground">
        {t("signup.displayname_hint")}
      </span>
    );
  }
  if (state.status === "checking") {
    return (
      <span
        id={id}
        className="text-xs text-muted-foreground"
        data-testid="displayname-check"
        data-state="checking"
      >
        {t("displayname.checking")}
      </span>
    );
  }
  if (state.status === "available") {
    return (
      <span
        id={id}
        className="text-xs text-emerald-600 dark:text-emerald-400"
        data-testid="displayname-check"
        data-state="available"
      >
        {t("displayname.available")}
      </span>
    );
  }
  return (
    <span
      id={id}
      className="text-xs text-destructive"
      data-testid="displayname-check"
      data-state="unavailable"
      data-reason={state.reason}
    >
      {t(`displayname.reason.${state.reason}`)}
    </span>
  );
}
