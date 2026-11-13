// Claude (Anthropic Messages API). Docs: https://docs.anthropic.com
import { AIError, AIRequest, AIResult, ModelOption, ProviderAdapter, readJson, request } from './types';

const LABEL = 'Claude';
const BASE = 'https://api.anthropic.com/v1';

const headers = (key: string, extra: Record<string, string> = {}) => ({
  'content-type': 'application/json',
  'x-api-key': key,
  'anthropic-version': '2023-06-01',
  ...extra,
});

// Newer models: forced tool choice is rejected (we use auto + an instruction) and effort is supported.
const supportsEffort = (model: string) => /claude-(opus|sonnet|haiku|fable|mythos)-(5|4-[6-9])/.test(model);
// Server-side refusal fallback is available on these models
const supportsFallback = (model: string) => /claude-(opus-5|sonnet-5-5|fable-5|mythos-5)/.test(model);

interface Block {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
}

export const anthropic: ProviderAdapter = {
  async send(req: AIRequest, { key, model }): Promise<AIResult> {
    const body: Record<string, unknown> = {
      model,
      max_tokens: req.maxTokens,
      system: req.system.map(s => ({ type: 'text', text: s.text, ...(s.cache ? { cache_control: { type: 'ephemeral' } } : {}) })),
      messages: req.messages.map(m => ({
        role: m.role,
        content:
          typeof m.content === 'string'
            ? m.content
            : m.content.map(p =>
                p.type === 'text'
                  ? { type: 'text', text: p.text }
                  : { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.base64 } },
              ),
      })),
    };
    if (req.tool) {
      body.tools = [{ name: req.tool.name, description: req.tool.description, input_schema: req.tool.schema }];
      body.tool_choice = { type: 'auto' };
    }
    if (req.effort && supportsEffort(model)) body.output_config = { effort: req.effort };
    const extra: Record<string, string> = {};
    if (supportsFallback(model)) {
      // If the model declines, the API retries on a suitable fallback model
      body.fallbacks = 'default';
      extra['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    }

    const res = await request(`${BASE}/messages`, { method: 'POST', headers: headers(key, extra), body: JSON.stringify(body) }, LABEL);
    const json = await readJson<{ content?: Block[]; stop_reason?: string }>(res, LABEL);
    if (json.stop_reason === 'refusal') throw new AIError('Claude declined this request. Try rewording it.');
    if (json.stop_reason === 'max_tokens') throw new AIError('Claude ran out of room for its answer. Try again.');

    const content = json.content ?? [];
    const text = content.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n').trim();
    const call = req.tool ? content.find(b => b.type === 'tool_use' && b.name === req.tool!.name) : undefined;
    return { text, toolInput: call?.input };
  },

  async listModels(key) {
    const res = await request(`${BASE}/models?limit=100`, { headers: headers(key) }, LABEL);
    const json = await readJson<{ data?: { id: string; display_name?: string }[] }>(res, LABEL);
    return (json.data ?? [])
      .filter(m => m.id.startsWith('claude'))
      .map((m): ModelOption => ({ id: m.id, label: m.display_name || m.id }));
  },
};
