// DeepSeek (OpenAI-compatible Chat Completions). Docs: https://api-docs.deepseek.com
// Thinking is on by default. In thinking mode DeepSeek rejects a forced tool, so we ask for the tool with
// tool_choice "auto" (the prompt names it) and, only if no tool call comes back, retry once with thinking off and
// the tool forced. Only deepseek-flash reads images; see PROVIDERS.deepseek.readsPhotos.
import { AIError, AIRequest, AIResult, Effort, ModelOption, ProviderAdapter, parseArgs, readJson, request } from './types';

const LABEL = 'DeepSeek';
// Ends in a slash: request paths are appended directly
const BASE = 'https://api.deepseek.com/';

const headers = (key: string) => ({ 'content-type': 'application/json', authorization: `Bearer ${key}` });

// DeepSeek's reasoning_effort takes low, high or max
const EFFORT: Record<Effort, string> = { low: 'low', medium: 'high', high: 'high' };
// Thinking tokens count toward max_tokens, so leave room for them as well as the answer
const THINKING_MIN_TOKENS = 32000;

interface ToolCall {
  type?: string;
  function?: { name?: string; arguments?: string };
}
interface ChatResponse {
  choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] }; finish_reason?: string }[];
}

function body(req: AIRequest, model: string, forceTool: boolean): Record<string, unknown> {
  const b: Record<string, unknown> = {
    model,
    // DeepSeek caches repeated prompt prefixes automatically, so the library block (last in system) needs no flag
    messages: [
      { role: 'system', content: req.system.map(s => s.text).join('\n\n') },
      ...req.messages.map(m => {
        if (typeof m.content === 'string') return { role: m.role, content: m.content };
        // Only user messages can carry images; flatten assistant turns to text
        if (m.role === 'assistant') {
          return { role: m.role, content: m.content.map(p => (p.type === 'text' ? p.text : '')).join('\n') };
        }
        return {
          role: m.role,
          content: m.content.map(p =>
            p.type === 'text'
              ? { type: 'text', text: p.text }
              : { type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.base64}`, detail: 'high' } },
          ),
        };
      }),
    ],
    stream: false,
  };
  if (forceTool) {
    b.thinking = { type: 'disabled' };
    b.max_tokens = req.maxTokens;
  } else {
    if (req.effort) b.reasoning_effort = EFFORT[req.effort];
    b.max_tokens = Math.max(req.maxTokens, THINKING_MIN_TOKENS);
  }
  if (req.tool) {
    b.tools = [{ type: 'function', function: { name: req.tool.name, description: req.tool.description, parameters: req.tool.schema } }];
    b.tool_choice = forceTool ? { type: 'function', function: { name: req.tool.name } } : 'auto';
  }
  return b;
}

async function call(req: AIRequest, key: string, model: string, forceTool: boolean): Promise<AIResult> {
  const hasImages = req.messages.some(m => typeof m.content !== 'string' && m.content.some(p => p.type === 'image'));
  const res = await request(`${BASE}chat/completions`, { method: 'POST', headers: headers(key), body: JSON.stringify(body(req, model, forceTool)) }, LABEL);
  let json: ChatResponse;
  try {
    json = await readJson<ChatResponse>(res, LABEL);
  } catch (e) {
    if (hasImages && e instanceof AIError && /image|vision|multimodal|modalit/i.test(e.message)) {
      throw new AIError(`The DeepSeek model "${model}" can't read photos. Pick deepseek-flash in Settings, or build your plan without photos.`);
    }
    throw e;
  }

  const choice = json.choices?.[0];
  if (choice?.finish_reason === 'length') throw new AIError('DeepSeek ran out of room for its answer. Try again.');
  if (choice?.finish_reason === 'content_filter') throw new AIError('DeepSeek declined this request. Try rewording it.');
  if (choice?.finish_reason === 'insufficient_system_resource') throw new AIError('DeepSeek is busy right now. Try again in a minute.');

  const message = choice?.message;
  const text = (message?.content ?? '').trim();
  const tool = req.tool ? message?.tool_calls?.find(t => t.function?.name === req.tool!.name) : undefined;
  return { text, toolInput: tool ? parseArgs(tool.function?.arguments, LABEL) : undefined };
}

export const deepseek: ProviderAdapter = {
  async send(req, { key, model }) {
    const first = await call(req, key, model, false);
    if (!req.tool || first.toolInput !== undefined) return first;
    // It answered in text instead of calling the tool: ask again with thinking off and the tool forced
    return call(req, key, model, true);
  },

  async listModels(key) {
    const res = await request(`${BASE}models`, { headers: headers(key) }, LABEL);
    const json = await readJson<{ data?: { id: string }[] }>(res, LABEL);
    return (json.data ?? [])
      .map(m => m.id)
      .filter(id => id.startsWith('deepseek'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((id): ModelOption => ({ id, label: id }));
  },
};
