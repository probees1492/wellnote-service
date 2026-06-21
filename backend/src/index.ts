import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./env";
import { authRoutes } from "./routes/auth";
import { memoRoutes } from "./routes/memos";
import { creditRoutes } from "./routes/credits";
import { activityRoutes } from "./routes/activity";
import { adminRoutes } from "./routes/admin";
import { streakRoutes } from "./routes/streak";
import { pinRoutes } from "./routes/pins";
import { userRoutes } from "./routes/users";
import { promptRoutes } from "./routes/prompts";
import { buddyRoutes } from "./routes/buddies";
import { interactionRoutes } from "./routes/interactions";
import { scheduled as dailyReadonlyScheduled } from "./cron/daily-readonly";
import { scheduled as dailyPromptsScheduled } from "./cron/daily-prompts";
import { onError } from "./lib/error-handler";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  /^https:\/\/wellnote-web-(dev|stage|prod)\.pages\.dev$/,
  /^https:\/\/[\w-]+\.wellnote-web-(dev|stage|prod)\.pages\.dev$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return origin;
      for (const a of ALLOWED_ORIGINS) {
        if (typeof a === "string" ? a === origin : a.test(origin)) return origin;
      }
      return null;
    },
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["authorization", "content-type"],
    credentials: false,
    maxAge: 600,
  }),
);

app.onError(onError);

app.get("/", (c) => c.json({ name: "wellnote-api", version: "0.1.0", ok: true }));
app.get("/health", (c) => c.json({ ok: true }));
app.get("/version", (c) => c.json({ name: "wellnote-api", version: "0.1.0" }));

app.route("/auth", authRoutes);
app.route("/memos", memoRoutes);
app.route("/credit", creditRoutes);
app.route("/activity", activityRoutes);
app.route("/admin", adminRoutes);
app.route("/streak", streakRoutes);
app.route("/pins", pinRoutes);
app.route("/users", userRoutes);
app.route("/prompts", promptRoutes);
app.route("/buddies", buddyRoutes);
// Reactions + short comments mount under /memos/* — co-located with memo routes
// so the public URLs read naturally: /memos/:id/reactions, /memos/:id/comments.
app.route("/", interactionRoutes);

/** Dispatch the scheduled handler based on which cron fired.
 *  - "0 15 * * *" (15:00 UTC / 00:00 KST) → daily-readonly sweep
 *  - "0 19 * * *" (19:00 UTC / 04:00 KST) → daily prompt-pool generation
 *  Falls back to daily-readonly if the cron string is unknown so we never
 *  silently drop a scheduled run.
 */
const scheduled: ExportedHandlerScheduledHandler<Env> = (
  controller,
  env,
  ctx,
) => {
  const cron = controller?.cron ?? "";
  if (cron === "0 19 * * *") {
    return dailyPromptsScheduled(controller, env, ctx);
  }
  return dailyReadonlyScheduled(controller, env, ctx);
};

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Env>;
