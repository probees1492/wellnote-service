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
import { scheduled as dailyReadonlyScheduled } from "./cron/daily-readonly";
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

export default {
  fetch: app.fetch,
  scheduled: dailyReadonlyScheduled,
} satisfies ExportedHandler<Env>;
