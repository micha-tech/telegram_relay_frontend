// Typed adapter for reusable signal formatting templates.
//
// Templates are workspace-scoped and admin-only. They never change the stored
// signal feed: the backend applies them only to copies forwarded to another
// chat. The preview endpoint runs the same formatter without sending anything.

import { ApiError, apiRequest } from "./api";

export { ApiError as TemplatesApiError };
export type { ApiErrorCode as TemplatesErrorCode } from "./api";

export interface Replacement {
  from: string;
  to: string;
}

export interface SignalTemplate {
  id: string;
  tenantId: string | null;
  name: string;
  body: string;
  header: string;
  footer: string;
  stripHeaderLines: number;
  removeUrls: boolean;
  removePatterns: string[];
  replacements: Replacement[];
  dropEmpty: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SignalTemplateInput {
  name: string;
  body?: string;
  header?: string;
  footer?: string;
  stripHeaderLines?: number;
  removeUrls?: boolean;
  removePatterns?: string[];
  replacements?: Replacement[];
  dropEmpty?: boolean;
}

export interface SignalTemplatePreviewInput extends Partial<SignalTemplateInput> {
  text?: string;
  source?: string;
  account?: string;
  author?: string;
  sentAt?: string;
  messageId?: string;
  peerId?: string;
}

export interface SignalTemplatePreview {
  formatted: string;
  skipped: boolean;
}

export interface TemplatesService {
  listTemplates(): Promise<SignalTemplate[]>;
  createTemplate(input: SignalTemplateInput): Promise<SignalTemplate>;
  updateTemplate(
    templateId: string,
    input: Partial<SignalTemplateInput>,
  ): Promise<SignalTemplate>;
  deleteTemplate(templateId: string): Promise<void>;
  previewTemplate(
    input: SignalTemplatePreviewInput,
  ): Promise<SignalTemplatePreview>;
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
  return fallback;
}

function parseReplacements(value: unknown): Replacement[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const from = readString(record, "from");
      const to = readString(record, "to");
      if (from === null || to === null) return null;
      return { from, to };
    })
    .filter((item): item is Replacement => item !== null);
}

function parseTemplate(value: unknown): SignalTemplate {
  const record = asRecord(value);
  const id = record ? readId(record.id) : null;
  if (!record || !id)
    throw new ApiError({
      code: "server",
      message: "The templates service returned an unexpected template.",
    });
  return {
    id,
    tenantId: readId(record.tenant),
    name: readString(record, "name") ?? "",
    body: readString(record, "body") ?? "",
    header: readString(record, "header") ?? "",
    footer: readString(record, "footer") ?? "",
    stripHeaderLines: readNumber(record.strip_header_lines, 0),
    removeUrls: record.remove_urls === true,
    removePatterns: Array.isArray(record.remove_patterns)
      ? record.remove_patterns.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    replacements: parseReplacements(record.replacements),
    dropEmpty: record.drop_empty !== false,
    createdAt: readString(record, "created_at"),
    updatedAt: readString(record, "updated_at"),
  };
}

function parseTemplateList(payload: unknown): SignalTemplate[] {
  const record = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : record && Array.isArray(record.results)
      ? record.results
      : null;
  if (!list)
    throw new ApiError({
      code: "server",
      message: "The templates service returned an unexpected template list.",
    });
  return list.map(parseTemplate);
}

function toTemplateBody(input: Partial<SignalTemplateInput>) {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.body !== undefined) body.body = input.body;
  if (input.header !== undefined) body.header = input.header;
  if (input.footer !== undefined) body.footer = input.footer;
  if (input.stripHeaderLines !== undefined)
    body.strip_header_lines = input.stripHeaderLines;
  if (input.removeUrls !== undefined) body.remove_urls = input.removeUrls;
  if (input.removePatterns !== undefined)
    body.remove_patterns = input.removePatterns;
  if (input.replacements !== undefined) body.replacements = input.replacements;
  if (input.dropEmpty !== undefined) body.drop_empty = input.dropEmpty;
  return body;
}

function toPreviewBody(input: SignalTemplatePreviewInput) {
  const body = toTemplateBody(input);
  if (input.text !== undefined) body.text = input.text;
  if (input.source !== undefined) body.source = input.source;
  if (input.account !== undefined) body.account = input.account;
  if (input.author !== undefined) body.author = input.author;
  if (input.sentAt !== undefined) body.sent_at = input.sentAt;
  if (input.messageId !== undefined) body.message_id = input.messageId;
  if (input.peerId !== undefined) body.peer_id = input.peerId;
  return body;
}

function parsePreview(payload: unknown): SignalTemplatePreview {
  const record = asRecord(payload);
  if (!record || typeof record.formatted !== "string")
    throw new ApiError({
      code: "server",
      message: "The templates service returned an unexpected preview.",
    });
  return {
    formatted: record.formatted,
    skipped: record.skipped === true,
  };
}

const templatePath = (templateId: string) =>
  `/signal-templates/${encodeURIComponent(templateId)}/`;

export function templatesErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "forbidden")
      return "Only workspace administrators can manage signal templates.";
    if (error.fieldErrors) {
      const first = Object.values(error.fieldErrors)[0];
      if (first) return first;
    }
    return error.message;
  }
  if (error instanceof TypeError)
    return "We couldn’t reach the templates service. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

export function createTemplatesService(): TemplatesService {
  return {
    async listTemplates() {
      const payload = await apiRequest<unknown>("/signal-templates/", {
        auth: true,
      });
      return parseTemplateList(payload);
    },
    async createTemplate(input) {
      const payload = await apiRequest<unknown>("/signal-templates/", {
        method: "POST",
        auth: true,
        body: toTemplateBody(input),
      });
      return parseTemplate(payload);
    },
    async updateTemplate(templateId, input) {
      const payload = await apiRequest<unknown>(templatePath(templateId), {
        method: "PATCH",
        auth: true,
        body: toTemplateBody(input),
      });
      return parseTemplate(payload);
    },
    async deleteTemplate(templateId) {
      await apiRequest<unknown>(templatePath(templateId), {
        method: "DELETE",
        auth: true,
      });
    },
    async previewTemplate(input) {
      const payload = await apiRequest<unknown>("/signal-templates/preview/", {
        method: "POST",
        auth: true,
        body: toPreviewBody(input),
      });
      return parsePreview(payload);
    },
  };
}

export const templatesService = createTemplatesService();
