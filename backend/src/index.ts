import { Hono } from "hono";
import type { Env, Variables } from "./env";
import { authRoutes } from "./routes/auth";
import { memoRoutes } from "./routes/memos";
import { creditRoutes } from "./routes/credits";
import { activityRoutes } from "./routes/activity";
import { adminRoutes } from "./routes/admin";
import { scheduled as dailyReadonlyScheduled } from "./cron/daily-readonly";
import { onError } from "./lib/error-handler";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.onError(onError);

app.get("/", (c) => c.json({ name: "wellnote-api", version: "0.1.0", ok: true }));
app.get("/health", (c) => c.json({ ok: true }));
app.get("/version", (c) => c.json({ name: "wellnote-api", version: "0.1.0" }));

app.route("/auth", authRoutes);
app.route("/memos", memoRoutes);
app.route("/credit", creditRoutes);
app.route("/activity", activityRoutes);
app.route("/admin", adminRoutes);

export default {
  fetch: app.fetch,
  scheduled: dailyReadonlyScheduled,
} satisfies ExportedHandler<Env>;
