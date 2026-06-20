import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg-primary">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-edge-blue" aria-hidden />
          <span className="text-base font-bold text-text-primary">
            WellNote
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              로그인
            </Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm">
              시작하기
            </Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-4xl font-bold leading-tight text-text-primary">
          매일 한 페이지, <span className="text-edge-blue">봉인되는</span>{" "}
          일기.
        </h1>
        <p className="mt-4 text-base text-text-muted">
          오늘에 집중하세요. 자정이 지나면 어제의 메모는 자동으로 봉인됩니다.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" data-testid="cta-start">
            <Button variant="primary" size="lg">
              무료로 시작하기
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg">
              로그인
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-20 md:grid-cols-3">
        <Card>
          <h3 className="text-lg font-semibold">오늘만 편집</h3>
          <p className="mt-2 text-sm text-text-muted">
            과거에 매달리지 않고 오늘에 집중합니다.
          </p>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold">활동 그리드</h3>
          <p className="mt-2 text-sm text-text-muted">
            364일치 기록을 한눈에 시각화합니다.
          </p>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold">크래딧 게이미피케이션</h3>
          <p className="mt-2 text-sm text-text-muted">
            꾸준히 쓰면 크래딧이 적립됩니다.
          </p>
        </Card>
      </section>
    </main>
  );
}
