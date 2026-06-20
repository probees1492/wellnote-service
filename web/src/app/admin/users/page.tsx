"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type AdminUserRow } from "@/lib/api";

function AdminUserDetailInner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState("");
  const [suspended, setSuspended] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api.adminGetUser(id);
      setUser(r);
      setSuspended(Boolean(r.isSuspended));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "사용자 정보를 불러오지 못했습니다.";
      setErr(message);
    }
  }

  useEffect(() => {
    if (!id) {
      router.replace("/admin");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function grant() {
    setMsg(null);
    setErr(null);
    try {
      const r = await api.adminGrant(id, Number(amount), reason);
      setMsg(`+${r.delta} 부여 완료. 잔액 ${r.balanceAfter}`);
      await load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "부여 실패";
      setErr(message);
    }
  }
  async function revoke() {
    setMsg(null);
    setErr(null);
    try {
      const r = await api.adminRevoke(id, Number(amount), reason);
      setMsg(`-${r.delta} 회수 완료. 잔액 ${r.balanceAfter}`);
      await load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "회수 실패";
      setErr(message);
    }
  }
  async function toggleSuspend() {
    setMsg(null);
    setErr(null);
    try {
      if (suspended) {
        await api.adminUnsuspend(id);
        setSuspended(false);
        setMsg("정지 해제 완료");
      } else {
        await api.adminSuspend(id);
        setSuspended(true);
        setMsg("정지 완료");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "변경 실패";
      setErr(message);
    }
  }

  if (!user) {
    return (
      <div className="text-sm text-muted-foreground">
        불러오는 중... ({err ?? ""})
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">사용자 상세</h1>
      <Card>
        <CardContent className="space-y-1 p-6 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ID</span>
            <span>{user.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">이메일</span>
            <span>{user.email || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">이름</span>
            <span>{user.displayName || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">크래딧 잔액</span>
            <span data-testid="admin-balance" className="font-semibold">
              {user.creditBalance}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>크래딧 조정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">금액</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reason">사유 (10~200자)</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={grant}>+{amount} 부여</Button>
            <Button variant="destructive" onClick={revoke}>
              -{amount} 회수
            </Button>
          </div>
          {msg ? <div className="text-sm">{msg}</div> : null}
          {err ? <div className="text-sm text-destructive">{err}</div> : null}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">위험 액션</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-sm">
            <span>
              정지 상태:{" "}
              <span className="font-medium">
                {suspended ? "정지됨" : "정상"}
              </span>
            </span>
            <Button
              variant={suspended ? "outline" : "destructive"}
              onClick={toggleSuspend}
            >
              {suspended ? "정지 해제" : "정지하기"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminUserDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">불러오는 중...</div>
      }
    >
      <AdminUserDetailInner />
    </Suspense>
  );
}
