"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { useAuth } from "@/lib/auth-store";

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuth((s) => s.signup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      await signup(email, password, displayName || undefined, { remember });
      router.push("/app");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "가입에 실패했습니다.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-6 py-16">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mb-2 flex justify-center">
              <LogoWordmark size="lg" />
            </div>
            <CardTitle className="text-xl">가입</CardTitle>
            <CardDescription>매일의 기록을 시작해 보세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={onSubmit}
              className="flex flex-col gap-4"
              aria-label="signup-form"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">이메일</Label>
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
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="signup-password"
                />
                <span className="text-xs text-muted-foreground">
                  8자 이상, 영문/숫자/특수문자 중 2종 이상
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">비밀번호 확인</Label>
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
                <Label htmlFor="displayName">표시 이름 (선택)</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  data-testid="signup-displayname"
                />
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
                <span className="select-none text-foreground">로그인 유지</span>
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
                disabled={loading}
                data-testid="signup-submit"
              >
                {loading ? "가입 중..." : "가입하기"}
              </Button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">또는</span>
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
                Apple로 계속하기 (Coming soon)
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="font-medium text-foreground underline">
                로그인
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
