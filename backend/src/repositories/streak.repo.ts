import type { StreakEvent, StreakEventType } from "../domain/streak";

export interface AppendStreakEventInput {
  userId: string;
  eventType: StreakEventType;
  dayKst: string;
  payload?: Record<string, unknown> | null;
}

export interface StreakRepo {
  appendEvent(input: AppendStreakEventInput): Promise<StreakEvent>;
  listByUser(opts: {
    userId: string;
    limit?: number;
  }): Promise<StreakEvent[]>;
}

interface StreakEventRow {
  id: number;
  user_id: string;
  event_type: StreakEventType;
  day_kst: string;
  payload: string | null;
  created_at: string;
}

function mapEvent(row: StreakEventRow): StreakEvent {
  let parsed: Record<string, unknown> | null = null;
  if (row.payload) {
    try {
      parsed = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    dayKst: row.day_kst,
    payload: parsed,
    createdAt: row.created_at,
  };
}

export class D1StreakRepo implements StreakRepo {
  constructor(private readonly db: D1Database) {}

  async appendEvent(input: AppendStreakEventInput): Promise<StreakEvent> {
    const now = new Date().toISOString();
    const payloadJson = input.payload ? JSON.stringify(input.payload) : null;
    const res = await this.db
      .prepare(
        `INSERT INTO streak_events (user_id, event_type, day_kst, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(input.userId, input.eventType, input.dayKst, payloadJson, now)
      .run();
    const id = Number(res.meta?.last_row_id ?? 0);
    return {
      id,
      userId: input.userId,
      eventType: input.eventType,
      dayKst: input.dayKst,
      payload: input.payload ?? null,
      createdAt: now,
    };
  }

  async listByUser(opts: {
    userId: string;
    limit?: number;
  }): Promise<StreakEvent[]> {
    const limit = Math.max(1, Math.min(opts.limit ?? 30, 100));
    const { results } = await this.db
      .prepare(
        `SELECT * FROM streak_events
          WHERE user_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
      )
      .bind(opts.userId, limit)
      .all<StreakEventRow>();
    return (results ?? []).map(mapEvent);
  }
}
