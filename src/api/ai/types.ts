// Provider-neutral request/response shapes. The coach code builds an AIRequest; each provider adapter
// (anthropic.ts, openai.ts, gemini.ts) translates it to that provider's API and back.
import type { KeyName } from '../../storage/store';

export type ProviderId = KeyName;
export type Effort = 'low' | 'medium' | 'high';

export type AIPart = { type: 'text'; text: string } | { type: 'image'; mediaType: 'image/jpeg'; base64: string };

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string | AIPart[];
}

/** A single function the model must call with its answer (structured output). */
export interface AITool {
  name: string;
  description: string;
  /** JSON Schema for the arguments */
  schema: Record<string, unknown>;
}

export interface AIRequest {
  /** System prompt blocks. `cache` marks large, stable blocks (e.g. the exercise library) for prompt caching. */
  system: { text: string; cache?: boolean }[];
  messages: AIMessage[];
  /** When set, the answer must come back as a call to this tool */
  tool?: AITool;
  maxTokens: number;
  effort?: Effort;
}

export interface AIResult {
  text: string;
  /** Parsed arguments of the tool call, when `tool` was set */
  toolInput?: unknown;
}

export interface ModelOption {
  id: string;
  label: string;
}

export interface ProviderAdapter {
  send(req: AIRequest, auth: { key: string; model: string }): Promise<AIResult>;
  listModels(key: string): Promise<ModelOption[]>;
}

/** Errors with a message that's safe and useful to show the user. Never includes the key. */
export class AIError extends Error {}

/** fetch with a friendly error when the phone is offline. */
export async function request(url: string, init: RequestInit, providerLabel: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new AIError(`Could not reach ${providerLabel}. Check your internet connection.`);
  }
}

/** Common HTTP error handling: maps status codes to plain messages. */
export async function readJson<T>(res: Response, providerLabel: string): Promise<T> {
  const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } | string }) | null;
  if (res.ok && json) return json;
  const raw = typeof json?.error === 'string' ? json.error : json?.error?.message;
  if (res.status === 401 || res.status === 403 || /api key|api_key|invalid.*key/i.test(raw ?? '')) {
    throw new AIError(`${providerLabel} rejected the API key. Check it in Settings.`);
  }
  if (res.status === 429) {
    throw new AIError(`${providerLabel} says you've hit a rate or usage limit. Wait a minute, or check your plan/billing.`);
  }
  if (res.status === 404) throw new AIError(`${providerLabel} doesn't recognise the selected model. Pick another in Settings.`);
  throw new AIError(`${providerLabel} error: ${(raw ?? `HTTP ${res.status}`).slice(0, 200)}`);
}

/** Parses a tool call's JSON arguments, with a friendly error. */
export function parseArgs(raw: unknown, providerLabel: string): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new AIError(`${providerLabel} returned an answer the app couldn't read. Try again.`);
  }
}
