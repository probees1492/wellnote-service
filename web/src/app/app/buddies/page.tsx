"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CaretLeft,
  Globe,
  Lock,
  Users,
} from "@phosphor-icons/react/dist/ssr";

import { BuddyAvatar } from "@/components/buddies/BuddyAvatar";
import { BuddyCard } from "@/components/buddies/BuddyCard";
import { FeedCard } from "@/components/buddies/FeedCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  api,
  type BuddyProfile,
  type FeedItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

type TabValue = "feed" | "search" | "mine";
type MineSubTab = "following" | "followers";

function BuddiesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");

  if (id) {
    return (
      <BuddyDetail
        userId={id}
        onBack={() => router.push("/app/buddies")}
      />
    );
  }
  return <BuddiesHub />;
}

/* ------------------------------------------------------------------ */
/* Top-level hub: tabs.                                                */
/* ------------------------------------------------------------------ */

function BuddiesHub() {
  const [tab, setTab] = useState<TabValue>("feed");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Users className="h-6 w-6" weight="duotone" aria-hidden />버디
      </h1>
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="feed" data-testid="buddies-tab-feed">
            피드
          </TabsTrigger>
          <TabsTrigger value="search" data-testid="buddies-tab-search">
            검색
          </TabsTrigger>
          <TabsTrigger value="mine" data-testid="buddies-tab-mine">
            내 버디
          </TabsTrigger>
        </TabsList>
        <TabsContent value="feed">
          <FeedTab />
        </TabsContent>
        <TabsContent value="search">
          <SearchTab />
        </TabsContent>
        <TabsContent value="mine">
          <MineTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feed tab — paginated FeedItem list.                                 */
/* ------------------------------------------------------------------ */

function FeedTab() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.buddies.feed();
        if (!alive) return;
        setItems(r.items);
        setCursor(r.nextCursor);
      } catch (e: unknown) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "피드를 불러오지 못했어요.";
        setErr(msg);
        setItems([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api.buddies.feed(cursor);
      setItems((prev) => (prev ? [...prev, ...r.items] : r.items));
      setCursor(r.nextCursor);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "더 불러오지 못했어요.";
      setErr(msg);
    } finally {
      setLoadingMore(false);
    }
  }

  if (err && !items?.length) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {err}
      </div>
    );
  }

  if (items === null) {
    return <div className="text-sm text-muted-foreground">불러오는 중...</div>;
  }

  if (items.length === 0) {
    return (
      <div
        className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground"
        data-testid="buddies-feed-empty"
      >
        팔로우하는 버디의 공개 핀 메모가 여기 모입니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="buddies-feed">
      {items.map((item) => (
        <FeedCard key={item.memoId} item={item} />
      ))}
      {cursor ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          data-testid="buddies-feed-more"
        >
          {loadingMore ? "불러오는 중..." : "더 보기"}
        </Button>
      ) : null}
      {err ? (
        <div className="text-xs text-destructive">{err}</div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Search tab — debounced display-name lookup.                         */
/* ------------------------------------------------------------------ */

function SearchTab() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BuddyProfile[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      setErr(null);
      setLoading(false);
      return;
    }
    const id = window.setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await api.buddies.search(term);
        setResults(r.items);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "검색에 실패했어요.";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="필명으로 검색"
        data-testid="buddies-search-input"
        autoFocus
      />
      {err ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {err}
        </div>
      ) : null}
      <div
        className="flex flex-col gap-2"
        data-testid="buddies-search-results"
        data-loading={loading ? "true" : "false"}
      >
        {results === null ? (
          <div className="text-sm text-muted-foreground">
            필명으로 검색해 보세요.
          </div>
        ) : results.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            일치하는 사용자가 없어요.
          </div>
        ) : (
          results.map((b) => <BuddyCard key={b.id} buddy={b} />)
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 내 버디 tab — following / followers.                                */
/* ------------------------------------------------------------------ */

function MineTab() {
  const [sub, setSub] = useState<MineSubTab>("following");
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={sub} onValueChange={(v) => setSub(v as MineSubTab)}>
        <TabsList>
          <TabsTrigger value="following" data-testid="buddies-sub-following">
            팔로잉
          </TabsTrigger>
          <TabsTrigger value="followers" data-testid="buddies-sub-followers">
            팔로워
          </TabsTrigger>
        </TabsList>
        <TabsContent value="following">
          <BuddyList
            kind="following"
            testid="buddies-following-list"
            emptyMessage="아직 팔로우하는 사람이 없어요. 검색으로 버디를 찾아보세요."
          />
        </TabsContent>
        <TabsContent value="followers">
          <BuddyList
            kind="followers"
            testid="buddies-followers-list"
            emptyMessage="아직 팔로워가 없어요."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface BuddyListProps {
  kind: "following" | "followers";
  testid: string;
  emptyMessage: string;
}

function BuddyList({ kind, testid, emptyMessage }: BuddyListProps) {
  const [items, setItems] = useState<BuddyProfile[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loader = useCallback(
    (c?: string) =>
      kind === "following"
        ? api.buddies.listMyFollowing(c)
        : api.buddies.listMyFollowers(c),
    [kind],
  );

  const load = useCallback(async () => {
    try {
      const r = await loader();
      setItems(r.items);
      setCursor(r.nextCursor);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "목록을 불러오지 못했어요.";
      setErr(msg);
      setItems([]);
    }
  }, [loader]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await loader(cursor);
      setItems((prev) => (prev ? [...prev, ...r.items] : r.items));
      setCursor(r.nextCursor);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "더 불러오지 못했어요.";
      setErr(msg);
    } finally {
      setLoadingMore(false);
    }
  }

  if (items === null) {
    return <div className="text-sm text-muted-foreground">불러오는 중...</div>;
  }

  if (err && items.length === 0) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {err}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid={testid}>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">{emptyMessage}</div>
      ) : (
        items.map((b) => (
          <BuddyCard
            key={b.id}
            buddy={b}
            onChange={(next) =>
              setItems((prev) =>
                prev
                  ? prev.map((it) => (it.id === next.id ? next : it))
                  : prev,
              )
            }
          />
        ))
      )}
      {cursor ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadMore()}
          disabled={loadingMore}
        >
          {loadingMore ? "불러오는 중..." : "더 보기"}
        </Button>
      ) : null}
      {err && items.length > 0 ? (
        <div className="text-xs text-destructive">{err}</div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buddy profile detail view — query param ?id=                        */
/* ------------------------------------------------------------------ */

function BuddyDetail({
  userId,
  onBack,
}: {
  userId: string;
  onBack: () => void;
}) {
  const me = useAuth((s) => s.user);
  const [profile, setProfile] = useState<BuddyProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [following, setFollowing] = useState<BuddyProfile[] | null>(null);
  const [followingErr, setFollowingErr] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    setProfile(null);
    setErr(null);
    setFollowing(null);
    setFollowingErr(null);
    (async () => {
      try {
        const r = await api.buddies.get(userId);
        if (!alive) return;
        setProfile(r.buddy);
      } catch (e: unknown) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "프로필을 불러오지 못했어요.";
        setErr(msg);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  // Following list — load when profile says it's accessible.
  useEffect(() => {
    if (!profile) return;
    const accessible =
      profile.isSelf || profile.followingVisibility === "public";
    if (!accessible) return;
    let alive = true;
    (async () => {
      try {
        const r = await api.buddies.listFollowing(profile.id);
        if (!alive) return;
        setFollowing(r.items);
        setCursor(r.nextCursor);
      } catch (e: unknown) {
        if (!alive) return;
        const code = (e as { status?: number }).status;
        if (code === 403) {
          setFollowingErr("친구 목록을 비공개로 설정한 사용자입니다.");
        } else {
          const msg = e instanceof Error ? e.message : "목록을 불러오지 못했어요.";
          setFollowingErr(msg);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile]);

  async function loadMoreFollowing() {
    if (!profile || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api.buddies.listFollowing(profile.id, cursor);
      setFollowing((prev) => (prev ? [...prev, ...r.items] : r.items));
      setCursor(r.nextCursor);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "더 불러오지 못했어요.";
      setFollowingErr(msg);
    } finally {
      setLoadingMore(false);
    }
  }

  if (err) {
    return (
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="w-fit"
          data-testid="buddy-detail-back"
        >
          <CaretLeft className="h-4 w-4" weight="bold" aria-hidden />버디
        </Button>
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="w-fit"
          data-testid="buddy-detail-back"
        >
          <CaretLeft className="h-4 w-4" weight="bold" aria-hidden />버디
        </Button>
        <div className="text-sm text-muted-foreground">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="w-fit"
        data-testid="buddy-detail-back"
      >
        <CaretLeft className="h-4 w-4" weight="bold" aria-hidden />버디
      </Button>

      <div className="flex flex-col gap-3 rounded-md border bg-card p-4 sm:flex-row sm:items-center">
        <BuddyAvatar
          displayName={profile.displayName}
          avatarUrl={profile.avatarUrl}
          sizeClass="h-16 w-16"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2
              className="truncate font-serif text-xl font-semibold"
              data-testid="buddy-detail-name"
            >
              {profile.displayName}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              {profile.followingVisibility === "public" ? (
                <>
                  <Globe className="h-3 w-3" weight="duotone" aria-hidden />
                  공개
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" weight="duotone" aria-hidden />
                  비공개
                </>
              )}
            </span>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>
              팔로워{" "}
              <span className="font-medium text-foreground">
                {profile.followerCount.toLocaleString()}
              </span>
            </span>
            <span>
              팔로잉{" "}
              <span className="font-medium text-foreground">
                {profile.followingCount.toLocaleString()}
              </span>
            </span>
          </div>
        </div>
        {profile.isSelf ? (
          <span className="text-xs text-muted-foreground">내 프로필</span>
        ) : (
          <FollowButton
            profile={profile}
            onChange={(next) => setProfile(next)}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {profile.isSelf ? "내가 팔로우하는 사람" : "이 사용자가 팔로우하는 사람"}
        </h3>
        {followingErr ? (
          <div
            className="rounded-md border border-muted bg-muted/30 p-3 text-sm text-muted-foreground"
            data-testid="buddy-detail-following-blocked"
          >
            {followingErr}
          </div>
        ) : following === null ? (
          <div className="text-sm text-muted-foreground">불러오는 중...</div>
        ) : following.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            아직 팔로우하는 사람이 없어요.
          </div>
        ) : (
          <div className="flex flex-col gap-2" data-testid="buddy-detail-following">
            {following.map((b) => (
              <BuddyCard key={b.id} buddy={b} />
            ))}
            {cursor ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadMoreFollowing()}
                disabled={loadingMore}
              >
                {loadingMore ? "불러오는 중..." : "더 보기"}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {/* Hint for the viewer when they're looking at themselves. */}
      {profile.isSelf && me ? (
        <div className="text-xs text-muted-foreground">
          공개 설정은 설정 페이지에서 변경할 수 있어요.
        </div>
      ) : null}
    </div>
  );
}

function FollowButton({
  profile,
  onChange,
}: {
  profile: BuddyProfile;
  onChange: (next: BuddyProfile) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    if (busy || profile.isSelf) return;
    setBusy(true);
    setErr(null);
    const wasFollowing = profile.isFollowing;
    const optimistic: BuddyProfile = {
      ...profile,
      isFollowing: !wasFollowing,
      followerCount: Math.max(
        0,
        profile.followerCount + (wasFollowing ? -1 : 1),
      ),
    };
    onChange(optimistic);
    try {
      const r = wasFollowing
        ? await api.buddies.unfollow(profile.id)
        : await api.buddies.follow(profile.id);
      onChange(r.buddy);
    } catch (e: unknown) {
      onChange(profile);
      const msg = e instanceof Error ? e.message : "요청에 실패했어요.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={profile.isFollowing ? "outline" : "default"}
        onClick={() => void toggle()}
        disabled={busy}
        data-testid="buddy-detail-follow"
      >
        {profile.isFollowing ? "팔로잉" : "팔로우"}
      </Button>
      {err ? <span className="text-xs text-destructive">{err}</span> : null}
    </div>
  );
}

export default function BuddiesPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">불러오는 중...</div>
      }
    >
      <BuddiesInner />
    </Suspense>
  );
}
