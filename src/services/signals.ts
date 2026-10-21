// Typed adapter for the scraped signals feed and the admin signal sources.
//
// Signals are Telegram messages that matched the keyword rules of a watched
// chat. Every signed-in user can read the feed; only super administrators can
// manage the watched chats and their rules.

import { ApiError, apiBaseUrl, apiRequest } from "./api";
import type { ApiErrorCode } from "./api";

export { ApiError as SignalsApiError };
export type { ApiErrorCode as SignalsErrorCode };

export function signalsApiBaseUrl() {
  return apiBaseUrl();
}

export interface Signal {
  id: string;
  accountId: string | null;
  accountLabel: string | null;
  sourceId: string | null;
  sourceName: string | null;
  chatId: string | null;
  messageId: string | null;
  text: string;
  author: string | null;
  matchedTerms: string[];
  sentAt: string | null;
  createdAt: string | null;
}

export interface SignalPage {
  count: number;
  page: number;
  pageSize: number;
  results: Signal[];
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface SignalQuery {
  q?: string;
  account?: string;
  source?: string;
  since?: string;
  page?: number;
  pageSize?: number;
}

export interface SignalCount {
  id: string;
  name: string;
  count: number;
}

export interface SignalStats {
  total: number;
  last24h: number;
  activeSources: number;
  bySource: SignalCount[];
  byAccount: SignalCount[];
}

export interface SignalRules {
  keywords: string[];
  blockedPhrases: string[];
  minLength: number;
  caseSensitive: boolean;
}

export interface SignalSource {
  id: string;
  accountId: string;
  accountLabel: string | null;
  entityId: string;
  chatTitle: string | null;
  chatUsername: string | null;
  peerId: string | null;
  name: string | null;
  enabled: boolean;
  rules: SignalRules;
  backfillLimit: number;
  lastScrapedAt: string | null;
  lastSignalAt: string | null;
  createdAt: string | null;
}

export interface SignalSourceInput {
  accountId: string;
  entityId: string;
  name?: string;
  enabled?: boolean;
  keywords: string[];
  blockedPhrases?: string[];
  minLength?: number;
  caseSensitive?: boolean;
  backfillLimit?: number;
}

export interface SignalsService {
  listSignals(query?: SignalQuery): Promise<SignalPage>;
  getStats(query?: SignalQuery): Promise<SignalStats>;
  listSources(): Promise<SignalSource[]>;
  createSource(input: SignalSourceInput): Promise<SignalSource>;
  updateSource(
    sourceId: string,
    input: Partial<SignalSourceInput>,
  ): Promise<SignalSource>;
  deleteSource(sourceId: string): Promise<void>;
  requestScrape(sourceId: string): Promise<void>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isFinite(Number(value))
  )
    return Number(value);
  return fallback;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function hasLink(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

function parseSignal(value: unknown): Signal {
  const record = asRecord(value);
  const id = record ? readId(record.id) : null;
  if (!record || !id)
    throw new ApiError({
      code: "server",
      message: "The signals service returned an unexpected signal.",
    });
  return {
    id,
    accountId: readId(record.account),
    accountLabel: readString(record, "account_label"),
    sourceId: readId(record.source),
    sourceName: readString(record, "source_name"),
    chatId: readId(record.chat_id),
    messageId: readId(record.message_id),
    text: typeof record.text === "string" ? record.text : "",
    author: readString(record, "author"),
    matchedTerms: readStringList(record.matched_terms),
    sentAt: readString(record, "sent_at"),
    createdAt: readString(record, "created_at"),
  };
}

function parseSignalPage(payload: unknown, query: SignalQuery): SignalPage {
  const record = asRecord(payload);
  const results =
    record && Array.isArray(record.results)
      ? record.results.map(parseSignal)
      : [];
  const count = record
    ? readNumber(record.count, results.length)
    : results.length;
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize =
    query.pageSize && query.pageSize > 0
      ? query.pageSize
      : results.length || 25;
  return {
    count,
    page,
    pageSize,
    results,
    hasNext: record ? hasLink(record.next) : false,
    hasPrevious: record ? hasLink(record.previous) : false,
  };
}

function parseCountList(value: unknown, idKey: string): SignalCount[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;
      const id = readId(record[idKey]);
      if (!id) return null;
      return {
        id,
        name: readString(record, "name") ?? "",
        count: readNumber(record.count, 0),
      };
    })
    .filter((entry): entry is SignalCount => entry !== null);
}

function parseStats(payload: unknown): SignalStats {
  const record = asRecord(payload);
  if (!record)
    throw new ApiError({
      code: "server",
      message: "The signals service returned an unexpected summary.",
    });
  return {
    total: readNumber(record.total, 0),
    last24h: readNumber(record.last_24h, 0),
    activeSources: readNumber(record.active_sources, 0),
    bySource: parseCountList(record.by_source, "source_id"),
    byAccount: parseCountList(record.by_account, "account_id"),
  };
}

function parseRules(value: unknown): SignalRules {
  const record = asRecord(value);
  return {
    keywords: record ? readStringList(record.keywords) : [],
    blockedPhrases: record ? readStringList(record.blocked_phrases) : [],
    minLength: record ? readNumber(record.min_length, 0) : 0,
    caseSensitive: record ? record.case_sensitive === true : false,
  };
}

function parseSource(value: unknown): SignalSource {
  const record = asRecord(value);
  const id = record ? readId(record.id) : null;
  const accountId = record ? readId(record.account) : null;
  const entityId = record ? readId(record.entity) : null;
  if (!record || !id || !accountId || !entityId)
    throw new ApiError({
      code: "server",
      message: "The signals service returned an unexpected source.",
    });
  return {
    id,
    accountId,
    accountLabel: readString(record, "account_label"),
    entityId,
    chatTitle: readString(record, "chat_title"),
    chatUsername: readString(record, "chat_username"),
    peerId: readId(record.peer_id),
    name: readString(record, "name"),
    enabled: record.enabled === true,
    rules: parseRules(record.rules),
    backfillLimit: readNumber(record.backfill_limit, 200),
    lastScrapedAt: readString(record, "last_scraped_at"),
    lastSignalAt: readString(record, "last_signal_at"),
    createdAt: readString(record, "created_at"),
  };
}

function parseSourceList(payload: unknown): SignalSource[] {
  const record = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : record && Array.isArray(record.results)
      ? record.results
      : null;
  if (!list)
    throw new ApiError({
      code: "server",
      message: "The signals service returned an unexpected source list.",
    });
  return list.map(parseSource);
}

function toRulesPayload(input: Partial<SignalSourceInput>) {
  const rules: Record<string, unknown> = {};
  if (input.keywords) rules.keywords = input.keywords;
  if (input.blockedPhrases) rules.blocked_phrases = input.blockedPhrases;
  if (input.minLength !== undefined) rules.min_length = input.minLength;
  if (input.caseSensitive !== undefined)
    rules.case_sensitive = input.caseSensitive;
  return rules;
}

function toSourceBody(input: Partial<SignalSourceInput>) {
  const body: Record<string, unknown> = {};
  if (input.accountId) body.account = input.accountId;
  if (input.entityId) body.entity = input.entityId;
  if (input.name !== undefined) body.name = input.name;
  if (input.enabled !== undefined) body.enabled = input.enabled;
  if (input.backfillLimit !== undefined)
    body.backfill_limit = input.backfillLimit;
  if (
    input.keywords !== undefined ||
    input.blockedPhrases !== undefined ||
    input.minLength !== undefined ||
    input.caseSensitive !== undefined
  )
    body.rules = toRulesPayload(input);
  return body;
}

const sourcePath = (sourceId: string) =>
  `/signal-sources/${encodeURIComponent(sourceId)}/`;

export function signalsErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "forbidden")
      return "Only super administrators can manage signal sources.";
    return error.message;
  }
  if (error instanceof TypeError)
    return "We couldn’t reach the signals service. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

export function createSignalsService(): SignalsService {
  return {
    async listSignals(query = {}) {
      const payload = await apiRequest<unknown>("/signals/", {
        auth: true,
        params: {
          q: query.q,
          account: query.account,
          source: query.source,
          since: query.since,
          page: query.page,
          page_size: query.pageSize,
        },
      });
      return parseSignalPage(payload, query);
    },
    async getStats(query = {}) {
      const payload = await apiRequest<unknown>("/signals/stats/", {
        auth: true,
        params: {
          q: query.q,
          account: query.account,
          source: query.source,
          since: query.since,
        },
      });
      return parseStats(payload);
    },
    async listSources() {
      const payload = await apiRequest<unknown>("/signal-sources/", {
        auth: true,
      });
      return parseSourceList(payload);
    },
    async createSource(input) {
      const payload = await apiRequest<unknown>("/signal-sources/", {
        method: "POST",
        auth: true,
        body: toSourceBody(input),
      });
      return parseSource(payload);
    },
    async updateSource(sourceId, input) {
      const payload = await apiRequest<unknown>(sourcePath(sourceId), {
        method: "PATCH",
        auth: true,
        body: toSourceBody(input),
      });
      return parseSource(payload);
    },
    async deleteSource(sourceId) {
      await apiRequest<unknown>(sourcePath(sourceId), {
        method: "DELETE",
        auth: true,
      });
    },
    async requestScrape(sourceId) {
      await apiRequest<unknown>(`${sourcePath(sourceId)}scrape/`, {
        method: "POST",
        auth: true,
      });
    },
  };
}

export const signalsService = createSignalsService();
