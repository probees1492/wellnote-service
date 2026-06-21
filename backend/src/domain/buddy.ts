/**
 * Buddy graph domain types.
 *
 * `Follow` is the raw join-table row. `BuddyProfile` is the materialised view
 * surfaced to the UI: includes counts + the viewer's relationship to the
 * subject (am I following them? do they follow me?).
 */

export type FollowingVisibility = "public" | "private";

export interface Follow {
  followerId: string;
  followeeId: string;
  createdAt: string;
}

export interface BuddyProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
  followingVisibility: FollowingVisibility;
  /** True iff the viewer currently follows this user. */
  isFollowing: boolean;
  /** True iff this user follows the viewer. */
  isFollower: boolean;
  /** True iff `id === viewerId`. */
  isSelf: boolean;
}

export function isFollowingVisibility(v: unknown): v is FollowingVisibility {
  return v === "public" || v === "private";
}
