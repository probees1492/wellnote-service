"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/app");
    } catch (e: any) {
      setError(e?.message ?? "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg-secondary py-16 px-6">
      <div className="mx-auto w-full max-w-md">
        <Card>
          <h1 className="text-2xl font-bold text-text-primary text-center">
            WellNote 로그인
          </h1>
          <form
            onSubmit={onSubmit}
            className="mt-6 flex flex-col gap-4"
            aria-label="login-form"
          >
            <Input
              id="email"
              label="이메일"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="login-email"
            />
            <Input
              id="password"
              label="비밀번호"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="login-password"
            />
            {error ? (
              <div
                className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger"
                data-testid="login-error"
              >
                {error}
              </div>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? "로그인 중..." : "로그인"}
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
            계정이 없으신가요?{" "}
            <Link href="/signup" className="text-edge-blue underline">
              가입하기
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
