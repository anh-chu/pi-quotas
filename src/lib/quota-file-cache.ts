/**
 * File-based shared quota cache.
 *
 * Written to ~/.pi/agent/quotas-cache.json so all concurrent pi sessions
 * share a single cache and avoid hammering provider APIs.
 *
 * Uses proper-lockfile (same as auth.json) for safe concurrent writes.
 * Reads are lock-free for performance; a torn read returns stale/empty.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import type { QuotaWindow, SupportedQuotaProvider } from "../types/quotas.js";

// --- serialization ----------------------------------------------------------

type SerializedWindow = Omit<QuotaWindow, "resetsAt"> & { resetsAt: string };
type FileCacheEntry = { windows: SerializedWindow[]; fetchedAt: number };
type FileCache = Partial<Record<SupportedQuotaProvider, FileCacheEntry>>;

function serialize(windows: QuotaWindow[]): SerializedWindow[] {
  return windows.map((w) => ({ ...w, resetsAt: w.resetsAt.toISOString() }));
}

function deserialize(windows: SerializedWindow[]): QuotaWindow[] {
  return windows.map((w) => ({ ...w, resetsAt: new Date(w.resetsAt) }));
}

// --- file helpers -----------------------------------------------------------

function cachePath(): string {
  return join(getAgentDir(), "quotas-cache.json");
}

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function readRaw(path: string): FileCache {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as FileCache;
  } catch {
    return {};
  }
}

// --- public API -------------------------------------------------------------

/**
 * Read a cache entry. Returns deserialized windows if the entry exists and
 * is younger than `ttlMs`, otherwise returns undefined.
 */
export function readCacheEntry(
  provider: SupportedQuotaProvider,
  ttlMs: number,
): QuotaWindow[] | undefined {
  const path = cachePath();
  if (!existsSync(path)) return undefined;
  const cache = readRaw(path);
  const entry = cache[provider];
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > ttlMs) return undefined;
  try {
    return deserialize(entry.windows);
  } catch {
    return undefined;
  }
}

/**
 * Read a cache entry regardless of age. Used as fallback when a network
 * request fails (e.g. 429) so we can serve stale data instead of an error.
 */
export function readStaleCacheEntry(
  provider: SupportedQuotaProvider,
): QuotaWindow[] | undefined {
  const path = cachePath();
  if (!existsSync(path)) return undefined;
  const cache = readRaw(path);
  const entry = cache[provider];
  if (!entry) return undefined;
  try {
    return deserialize(entry.windows);
  } catch {
    return undefined;
  }
}

/**
 * Write a cache entry. Uses a write-to-temp-then-rename pattern so readers
 * never see a partial file. Concurrent writers may overwrite each other but
 * the file is always valid JSON — worst case is a redundant network fetch.
 */
export function writeCacheEntry(
  provider: SupportedQuotaProvider,
  windows: QuotaWindow[],
): void {
  const path = cachePath();
  try {
    ensureDir(path);
    const cache = readRaw(path);
    cache[provider] = { windows: serialize(windows), fetchedAt: Date.now() };
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(cache, null, 2), "utf-8");
    renameSync(tmp, path);
  } catch {
    // Cache write failed — not critical, next fetch will try again
  }
}
