import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogoLockup, LogoWordmark } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur lg:px-8">
        <LogoLockup wordmarkSize="md" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="sm">
              로그인
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">시작하기</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="mb-6 flex justify-center">
          <LogoWordmark size="xl" />
        </div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          We will note!
        </p>
        <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight text-foreground lg:text-4xl">
          매일 한 페이지,{" "}
          <span className="text-primary/80">봉인되는</span> 일기.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground lg:text-lg">
          오늘에 집중하세요. 자정이 지나면 어제의 메모는 자동으로 봉인됩니다.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link href="/signup" data-testid="cta-start">
            <Button size="lg">무료로 시작하기</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              로그인
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-24 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>오늘만 편집</CardTitle>
            <CardDescription>
              과거에 매달리지 않고 오늘에 집중합니다.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>활동 그리드</CardTitle>
            <CardDescription>
              364일치 기록을 한눈에 시각화합니다.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>크래딧 게이미피케이션</CardTitle>
            <CardDescription>
              꾸준히 쓰면 크래딧이 적립됩니다.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </main>
  );
}
