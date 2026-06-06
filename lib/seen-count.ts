import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { SafetyStatus, Verdict } from "@/lib/schema";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: unknown[]): unknown;
      get(...params: unknown[]): Record<string, unknown> | undefined;
    };
  };
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "you",
  "your",
  "this",
  "that",
  "with",
  "from",
  "have",
  "has",
  "are",
  "was",
  "were",
  "will",
  "shall",
  "please",
  "message",
  "forward",
  "share",
  "http",
  "https"
]);

export type SeenCountMetadata = {
  hasLink: boolean;
  hasAudio: boolean;
  hasImage: boolean;
  hasVideo?: boolean;
  detectedLanguage?: string;
};

export type SeenCountStats = {
  exactMessageHash: string;
  similarityKey: string;
  seenCount: number;
  similarSeenCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCountLabel: string;
  viralRiskLevel: "low" | "medium" | "high";
};

function defaultDbPath() {
  return process.env.SEEN_COUNT_DB_PATH || path.join(process.cwd(), "data", "seen-count.sqlite");
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function extractUrls(text: string) {
  return text.match(/https?:\/\/[^\s)]+/gi) ?? [];
}

function hostToken(url: string) {
  try {
    return `host:${new URL(url).hostname.replace(/^www\./, "").toLowerCase()}`;
  } catch {
    return "host:invalid";
  }
}

export function normalizeMessageForExactHash(text: string) {
  return text
    .toLowerCase()
    .replace(/\bgovt\b/g, "government")
    .replace(/https?:\/\/[^\s)]+/gi, (url) => hostToken(url))
    .replace(/[^\p{L}\p{N}:./\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSimilarityKey(text: string) {
  const normalized = normalizeMessageForExactHash(text);
  const hostTokens = extractUrls(text).map(hostToken);
  const words = normalized
    .replace(/host:[^\s]+/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  const tokenCounts = new Map<string, number>();

  for (const word of words) {
    tokenCounts.set(word, (tokenCounts.get(word) ?? 0) + 1);
  }

  const topTokens = Array.from(tokenCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 18)
    .map(([word]) => word)
    .sort();

  return [...new Set([...hostTokens.sort(), ...topTokens])].join("|") || "empty";
}

export function fingerprintMessage(text: string) {
  const normalized = normalizeMessageForExactHash(text);
  const similarityKey = buildSimilarityKey(text);

  return {
    normalized,
    exactMessageHash: hash(normalized),
    similarityKey
  };
}

function labelFor(seenCount: number, similarSeenCount: number) {
  if (similarSeenCount >= 200) {
    return `Similar messages have been checked over ${similarSeenCount} times in this app.`;
  }

  if (similarSeenCount >= 20) {
    return `Similar messages have been checked ${similarSeenCount} times in this app.`;
  }

  return `This exact message has been checked ${seenCount} time${seenCount === 1 ? "" : "s"} in this app.`;
}

export function viralRiskFor(seenCount: number, similarSeenCount: number): "low" | "medium" | "high" {
  if (similarSeenCount >= 200) {
    return "high";
  }

  if (similarSeenCount >= 100 || seenCount >= 20) {
    return "medium";
  }

  return "low";
}

export class SeenCountStore {
  private db: InstanceType<typeof DatabaseSync>;

  constructor(dbPath = defaultDbPath()) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_seen_counts (
        exact_hash TEXT PRIMARY KEY,
        similarity_key TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        seen_count INTEGER NOT NULL DEFAULT 1,
        last_safety_status TEXT,
        last_verdict TEXT,
        has_link INTEGER NOT NULL DEFAULT 0,
        has_audio INTEGER NOT NULL DEFAULT 0,
        has_image INTEGER NOT NULL DEFAULT 0,
        has_video INTEGER NOT NULL DEFAULT 0,
        detected_language TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_message_seen_similarity
        ON message_seen_counts(similarity_key);
    `);
    try {
      this.db.exec("ALTER TABLE message_seen_counts ADD COLUMN has_video INTEGER NOT NULL DEFAULT 0;");
    } catch {
      // Existing v1 databases may already have this column.
    }
  }

  recordSeen(text: string, metadata: SeenCountMetadata): SeenCountStats {
    const fingerprint = fingerprintMessage(text);
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        INSERT INTO message_seen_counts (
          exact_hash, similarity_key, first_seen_at, last_seen_at, seen_count,
          has_link, has_audio, has_image, has_video, detected_language
        )
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        ON CONFLICT(exact_hash) DO UPDATE SET
          last_seen_at = excluded.last_seen_at,
          seen_count = seen_count + 1,
          has_link = excluded.has_link,
          has_audio = excluded.has_audio,
          has_image = excluded.has_image,
          has_video = excluded.has_video,
          detected_language = COALESCE(excluded.detected_language, detected_language)
      `
      )
      .run(
        fingerprint.exactMessageHash,
        fingerprint.similarityKey,
        now,
        now,
        metadata.hasLink ? 1 : 0,
        metadata.hasAudio ? 1 : 0,
        metadata.hasImage ? 1 : 0,
        metadata.hasVideo ? 1 : 0,
        metadata.detectedLanguage ?? null
      );

    const exact = this.db
      .prepare(
        `
        SELECT seen_count AS seenCount, first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt
        FROM message_seen_counts
        WHERE exact_hash = ?
      `
      )
      .get(fingerprint.exactMessageHash) as
      | { seenCount: number; firstSeenAt: string; lastSeenAt: string }
      | undefined;
    const similar = this.db
      .prepare(
        `
        SELECT COALESCE(SUM(seen_count), 0) AS similarSeenCount
        FROM message_seen_counts
        WHERE similarity_key = ?
      `
      )
      .get(fingerprint.similarityKey) as { similarSeenCount: number } | undefined;
    const seenCount = Number(exact?.seenCount ?? 1);
    const similarSeenCount = Number(similar?.similarSeenCount ?? seenCount);

    return {
      exactMessageHash: fingerprint.exactMessageHash,
      similarityKey: fingerprint.similarityKey,
      seenCount,
      similarSeenCount,
      firstSeenAt: exact?.firstSeenAt ?? now,
      lastSeenAt: exact?.lastSeenAt ?? now,
      seenCountLabel: labelFor(seenCount, similarSeenCount),
      viralRiskLevel: viralRiskFor(seenCount, similarSeenCount)
    };
  }

  updateOutcome({
    exactMessageHash,
    safetyStatus,
    verdict,
    detectedLanguage
  }: {
    exactMessageHash: string;
    safetyStatus?: SafetyStatus;
    verdict: Verdict;
    detectedLanguage?: string;
  }) {
    this.db
      .prepare(
        `
        UPDATE message_seen_counts
        SET last_safety_status = ?, last_verdict = ?, detected_language = COALESCE(?, detected_language)
        WHERE exact_hash = ?
      `
      )
      .run(safetyStatus ?? null, verdict, detectedLanguage ?? null, exactMessageHash);
  }

  close() {
    const close = (this.db as unknown as { close?: () => void }).close;
    close?.call(this.db);
  }
}

let defaultStore: SeenCountStore | undefined;

export function getSeenCountStore() {
  defaultStore ??= new SeenCountStore();
  return defaultStore;
}
