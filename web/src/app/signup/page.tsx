"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth-store";

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuth((s) => s.signup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
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
      await signup(email, password, displayName || undefined);
      router.push("/app");
    } catch (e: any) {
      setError(e?.message ?? "가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg-secondary py-16 px-6">
      <div className="mx-auto w-full max-w-md">
        <Card>
          <h1 className="text-2xl font-bold text-text-primary text-center">
            WellNote 가입
          </h1>
          <p className="mt-2 text-sm text-text-muted text-center">
            매일의 기록을 시작해 보세요.
          </p>
          <form
            onSubmit={onSubmit}
            className="mt-6 flex flex-col gap-4"
            aria-label="signup-form"
          >
            <Input
              id="email"
              label="이메일"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="signup-email"
            />
            <Input
              id="password"
              label="비밀번호"
              type="password"
              required
              helper="8자 이상, 영문/숫자/특수문자 중 2종 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="signup-password"
            />
            <Input
              id="confirm"
              label="비밀번호 확인"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              data-testid="signup-confirm"
            />
            <Input
              id="displayName"
              label="표시 이름 (선택)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              data-testid="signup-displayname"
            />
            {error ? (
              <div
                className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger"
                data-testid="signup-error"
              >
                {error}
              </div>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              data-testid="signup-submit"
            >
              {loading ? "가입 중..." : "가입하기"}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-text-muted">또는</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="secondary" size="md" disabled>
              Google로 계속하기 (Coming soon)
            </Button>
            <Button variant="secondary" size="md" disabled>
              Apple로 계속하기 (Coming soon)
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-text-muted">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-edge-blue underline">
              로그인
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
