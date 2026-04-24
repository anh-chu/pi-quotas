import type { AuthStorage } from "@mariozechner/pi-coding-agent";
import { PROVIDER_FETCHERS } from "../providers/fetch.js";
import type { QuotasResult, SupportedQuotaProvider } from "../types/quotas.js";
import { readCacheEntry, readStaleCacheEntry, writeCacheEntry } from "./quota-file-cache.js";

export const SUPPORTED_PROVIDERS: SupportedQuotaProvider[] = [
  "anthropic",
  "openai-codex",
  "github-copilot",
  "openrouter",
];

export const PROVIDER_LABELS: Record<SupportedQuotaProvider, string> = {
  anthropic: "Anthropic",
  "openai-codex": "OpenAI Codex",
  "github-copilot": "GitHub Copilot",
  openrouter: "OpenRouter",
};

const PROVIDER_TTLS_MS: Record<SupportedQuotaProvider, number> = {
  anthropic: 5 * 60_000,
  "openai-codex": 60_000,
  "github-copilot": 5 * 60_000,
  openrouter: 60_000,
};

export function isSupportedProvider(
  provider: string | undefined,
): provider is SupportedQuotaProvider {
  return SUPPORTED_PROVIDERS.includes(provider as SupportedQuotaProvider);
}

export async function fetchProviderQuotas(
  authStorage: AuthStorage,
  provider: SupportedQuotaProvider,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<QuotasResult> {
  const ttl = PROVIDER_TTLS_MS[provider];

  // Serve from file cache if fresh
  if (!options?.force) {
    const cached = readCacheEntry(provider, ttl);
    if (cached) return { success: true, data: { provider, windows: cached } };
  }

  // Fetch from network
  const result = await PROVIDER_FETCHERS[provider](authStorage, options?.signal);

  if (result.success) {
    writeCacheEntry(provider, result.data.windows);
    return result;
  }

  // On failure, serve stale cache rather than surfacing an error
  const stale = readStaleCacheEntry(provider);
  if (stale) return { success: true, data: { provider, windows: stale } };

  return result;
}

export async function fetchAllProviderQuotas(
  authStorage: AuthStorage,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<Array<{ provider: SupportedQuotaProvider; result: QuotasResult }>> {
  return Promise.all(
    SUPPORTED_PROVIDERS.map(async (provider) => ({
      provider,
      result: await fetchProviderQuotas(authStorage, provider, options),
    })),
  );
}

export function formatResetTime(renewsAt: string): string {
  const date = new Date(renewsAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) return "soon";

  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays < 7) return `in ${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
