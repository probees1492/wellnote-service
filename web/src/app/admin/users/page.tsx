"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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
    } catch (e: any) {
      setErr(e?.message ?? "사용자 정보를 불러오지 못했습니다.");
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
    } catch (e: any) {
      setErr(e?.message ?? "부여 실패");
    }
  }
  async function revoke() {
    setMsg(null);
    setErr(null);
    try {
      const r = await api.adminRevoke(id, Number(amount), reason);
      setMsg(`-${r.delta} 회수 완료. 잔액 ${r.balanceAfter}`);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "회수 실패");
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
    } catch (e: any) {
      setErr(e?.message ?? "변경 실패");
    }
  }

  if (!user) {
    return (
      <div className="text-sm text-text-muted">불러오는 중... ({err ?? ""})</div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">사용자 상세</h1>
      <Card>
        <div className="text-sm text-text-secondary">
          <div>
            <span className="text-text-muted">ID: </span>
            {user.id}
          </div>
          <div>
            <span className="text-text-muted">이메일: </span>
            {user.email || "—"}
          </div>
          <div>
            <span className="text-text-muted">이름: </span>
            {user.displayName || "—"}
          </div>
          <div>
            <span className="text-text-muted">크래딧 잔액: </span>
            <span data-testid="admin-balance" className="font-semibold">
              {user.creditBalance}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">크래딧 조정</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Input
            id="amount"
            label="금액"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            id="reason"
            label="사유 (10~200자)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={grant}>
            +{amount} 부여
          </Button>
          <Button variant="danger" onClick={revoke}>
            -{amount} 회수
          </Button>
        </div>
        {msg ? (
          <div className="mt-2 text-sm text-edge-blue">{msg}</div>
        ) : null}
        {err ? <div className="mt-2 text-sm text-danger">{err}</div> : null}
      </Card>

      <Card className="border-danger/40">
        <h2 className="text-lg font-semibold text-danger">위험 액션</h2>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span>
            정지 상태:{" "}
            <span className="font-medium">{suspended ? "정지됨" : "정상"}</span>
          </span>
          <Button variant={suspended ? "secondary" : "danger"} onClick={toggleSuspend}>
            {suspended ? "정지 해제" : "정지하기"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function AdminUserDetailPage() {
  return (
    <Suspense fallback={<div className="text-sm text-text-muted">불러오는 중...</div>}>
      <AdminUserDetailInner />
    </Suspense>
  );
}
