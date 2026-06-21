/**
 * Thin client over Cloudflare's GraphQL Analytics API. We query a small set
 * of node types and aggregate down to a single scalar per metric so the
 * cron handler can stuff the day's snapshot into KV without ceremony.
 *
 * Endpoint: https://api.cloudflare.com/client/v4/graphql/
 * Auth:     Bearer token with `Account Analytics: Read` permission. The
 *           service treats a missing token / 4xx response as "unavailable"
 *           and returns nulls — the admin UI will then render "—".
 */

export interface UsageSnapshot {
  /** Datetime (UTC) the snapshot was generated. */
  generatedAt: string;
  /** Window the metrics cover. */
  windowStart: string;
  windowEnd: string;
  /** Window length in hours — usually 24. */
  windowHours: number;

  // --- per-day metrics (24h window) ---
  workers: { requests: number | null; errors: number | null } | null;
  workersAi: { neurons: number | null } | null;
  d1: {
    readQueries: number | null;
    writeQueries: number | null;
    rowsRead: number | null;
    rowsWritten: number | null;
  } | null;
  kv: {
    reads: number | null;
    writes: number | null;
    deletes: number | null;
  } | null;

  // --- per-month metrics (30d window) ---
  r2: {
    classAOps: number | null;
    classBOps: number | null;
    storageBytes: number | null;
  } | null;
}

interface FetchOpts {
  accountId: string;
  token: string;
  fetchImpl?: typeof fetch;
}

/** GraphQL endpoint. Constants pulled out so tests can mock with msw. */
const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql/";

async function gql<T>(
  opts: FetchOpts,
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  const fetcher = opts.fetchImpl ?? fetch;
  try {
    const res = await fetcher(GRAPHQL_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${opts.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: T; errors?: unknown };
    if (body.errors) return null;
    return (body.data ?? null) as T | null;
  } catch {
    return null;
  }
}

function isoFloorHour(d: Date): string {
  const x = new Date(d);
  x.setUTCMinutes(0, 0, 0);
  return x.toISOString();
}

/**
 * Pulls all five datasets in parallel. Each individual query failing
 * leaves the corresponding slot null instead of failing the whole
 * snapshot — Cloudflare occasionally rotates schema names and we'd rather
 * surface "—" than 500 on the admin page.
 */
export async function fetchUsageSnapshot(
  opts: FetchOpts,
  now: Date = new Date(),
): Promise<UsageSnapshot> {
  const day = 24 * 60 * 60 * 1000;
  const end = isoFloorHour(now);
  const start = isoFloorHour(new Date(now.getTime() - day));
  const monthStart = isoFloorHour(new Date(now.getTime() - 30 * day));

  const [workers, workersAi, d1, kv, r2] = await Promise.all([
    fetchWorkers(opts, start, end),
    fetchWorkersAi(opts, start, end),
    fetchD1(opts, start, end),
    fetchKv(opts, start, end),
    fetchR2(opts, monthStart, end),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    windowStart: start,
    windowEnd: end,
    windowHours: 24,
    workers,
    workersAi,
    d1,
    kv,
    r2,
  };
}

// ---------------------------------------------------------------------------
// Per-dataset queries. Each returns null if the field shape doesn't match
// (Cloudflare adds / renames dimensions on these adaptive groups over time).
// ---------------------------------------------------------------------------

async function fetchWorkers(
  opts: FetchOpts,
  start: string,
  end: string,
): Promise<UsageSnapshot["workers"]> {
  const data = await gql<{
    viewer?: {
      accounts?: Array<{
        workersInvocationsAdaptive?: Array<{
          sum?: { requests?: number; errors?: number };
        }>;
      }>;
    };
  }>(
    opts,
    `query($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            filter: { datetime_geq: $start, datetime_lt: $end }
            limit: 10000
          ) {
            sum { requests errors }
          }
        }
      }
    }`,
    { accountTag: opts.accountId, start, end },
  );
  const buckets = data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
  if (buckets.length === 0) return null;
  let requests = 0;
  let errors = 0;
  for (const b of buckets) {
    requests += Number(b.sum?.requests ?? 0);
    errors += Number(b.sum?.errors ?? 0);
  }
  return { requests, errors };
}

async function fetchWorkersAi(
  opts: FetchOpts,
  start: string,
  end: string,
): Promise<UsageSnapshot["workersAi"]> {
  const data = await gql<{
    viewer?: {
      accounts?: Array<{
        workersAiInferenceAdaptiveGroups?: Array<{
          sum?: { neuronsTotal?: number };
        }>;
      }>;
    };
  }>(
    opts,
    `query($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersAiInferenceAdaptiveGroups(
            filter: { datetime_geq: $start, datetime_lt: $end }
            limit: 10000
          ) {
            sum { neuronsTotal }
          }
        }
      }
    }`,
    { accountTag: opts.accountId, start, end },
  );
  const buckets =
    data?.viewer?.accounts?.[0]?.workersAiInferenceAdaptiveGroups ?? [];
  if (buckets.length === 0) return { neurons: 0 };
  let neurons = 0;
  for (const b of buckets) neurons += Number(b.sum?.neuronsTotal ?? 0);
  return { neurons };
}

async function fetchD1(
  opts: FetchOpts,
  start: string,
  end: string,
): Promise<UsageSnapshot["d1"]> {
  const data = await gql<{
    viewer?: {
      accounts?: Array<{
        d1AnalyticsAdaptiveGroups?: Array<{
          sum?: {
            readQueries?: number;
            writeQueries?: number;
            rowsRead?: number;
            rowsWritten?: number;
          };
        }>;
      }>;
    };
  }>(
    opts,
    `query($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          d1AnalyticsAdaptiveGroups(
            filter: { datetime_geq: $start, datetime_lt: $end }
            limit: 10000
          ) {
            sum { readQueries writeQueries rowsRead rowsWritten }
          }
        }
      }
    }`,
    { accountTag: opts.accountId, start, end },
  );
  const buckets =
    data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups ?? [];
  if (buckets.length === 0) return null;
  let readQueries = 0;
  let writeQueries = 0;
  let rowsRead = 0;
  let rowsWritten = 0;
  for (const b of buckets) {
    readQueries += Number(b.sum?.readQueries ?? 0);
    writeQueries += Number(b.sum?.writeQueries ?? 0);
    rowsRead += Number(b.sum?.rowsRead ?? 0);
    rowsWritten += Number(b.sum?.rowsWritten ?? 0);
  }
  return { readQueries, writeQueries, rowsRead, rowsWritten };
}

async function fetchKv(
  opts: FetchOpts,
  start: string,
  end: string,
): Promise<UsageSnapshot["kv"]> {
  const data = await gql<{
    viewer?: {
      accounts?: Array<{
        kvOperationsAdaptiveGroups?: Array<{
          sum?: { requests?: number };
          dimensions?: { actionType?: string };
        }>;
      }>;
    };
  }>(
    opts,
    `query($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          kvOperationsAdaptiveGroups(
            filter: { datetime_geq: $start, datetime_lt: $end }
            limit: 10000
          ) {
            sum { requests }
            dimensions { actionType }
          }
        }
      }
    }`,
    { accountTag: opts.accountId, start, end },
  );
  const buckets = data?.viewer?.accounts?.[0]?.kvOperationsAdaptiveGroups ?? [];
  if (buckets.length === 0) return null;
  let reads = 0;
  let writes = 0;
  let deletes = 0;
  for (const b of buckets) {
    const n = Number(b.sum?.requests ?? 0);
    switch (b.dimensions?.actionType) {
      case "read":
      case "list":
        reads += n;
        break;
      case "write":
        writes += n;
        break;
      case "delete":
        deletes += n;
        break;
      default:
        reads += n; // unknown actions counted as reads to avoid silent drops
    }
  }
  return { reads, writes, deletes };
}

async function fetchR2(
  opts: FetchOpts,
  start: string,
  end: string,
): Promise<UsageSnapshot["r2"]> {
  const data = await gql<{
    viewer?: {
      accounts?: Array<{
        r2OperationsAdaptiveGroups?: Array<{
          sum?: { requests?: number };
          dimensions?: { actionType?: string };
        }>;
        r2StorageAdaptiveGroups?: Array<{
          max?: { payloadSize?: number };
        }>;
      }>;
    };
  }>(
    opts,
    `query($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          r2OperationsAdaptiveGroups(
            filter: { datetime_geq: $start, datetime_lt: $end }
            limit: 10000
          ) {
            sum { requests }
            dimensions { actionType }
          }
          r2StorageAdaptiveGroups(
            filter: { datetime_geq: $start, datetime_lt: $end }
            limit: 1
            orderBy: [datetime_DESC]
          ) {
            max { payloadSize }
          }
        }
      }
    }`,
    { accountTag: opts.accountId, start, end },
  );
  const ops = data?.viewer?.accounts?.[0]?.r2OperationsAdaptiveGroups ?? [];
  const storage = data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups ?? [];
  if (ops.length === 0 && storage.length === 0) return null;

  // R2 billing classes per Cloudflare docs:
  //   Class A: PutObject, CopyObject, PostObject, ListBuckets, ListObjects, ...
  //   Class B: GetObject, HeadObject, HeadBucket, ...
  const classA = new Set([
    "ListBuckets",
    "PutBucket",
    "ListObjects",
    "PutObject",
    "CopyObject",
    "CompleteMultipartUpload",
    "CreateMultipartUpload",
    "LifecycleStorageTierTransition",
    "PutBucketEncryption",
    "PutBucketCors",
    "PutBucketLifecycleConfiguration",
  ]);
  const classB = new Set([
    "HeadBucket",
    "HeadObject",
    "GetObject",
    "UsageSummary",
    "GetBucketEncryption",
    "GetBucketLocation",
    "GetBucketCors",
    "GetBucketLifecycleConfiguration",
  ]);
  let classAOps = 0;
  let classBOps = 0;
  for (const b of ops) {
    const n = Number(b.sum?.requests ?? 0);
    const t = b.dimensions?.actionType ?? "";
    if (classA.has(t)) classAOps += n;
    else if (classB.has(t)) classBOps += n;
    else classAOps += n; // unknown → conservative bucket
  }
  const storageBytes = Number(storage?.[0]?.max?.payloadSize ?? 0);
  return { classAOps, classBOps, storageBytes };
}
