// ChatGPT models (OpenAI Responses API). Docs: https://developers.openai.com/api/docs
import { AIError, AIRequest, AIResult, ModelOption, ProviderAdapter, parseArgs, readJson, request } from './types';

const LABEL = 'OpenAI';
const BASE = 'https://api.openai.com/v1';

const headers = (key: string) => ({ 'content-type': 'application/json', authorization: `Bearer ${key}` });

// Reasoning models take reasoning.effort
const isReasoning = (model: string) => /^(gpt-[5-9]|o\d)/.test(model);
// Chat-capable text models only, for the model picker
const CHAT_MODEL = /^(gpt-[4-9]|o\d|chat-latest)/;
const NOT_CHAT = /(image|audio|realtime|transcribe|tts|live|search|embedding|moderation|cyber|codex|oss|rosalind|whisper|translate|instruct)/;

interface OutputItem {
  type: string;
  name?: string;
  arguments?: string;
  content?: { type: string; text?: string; refusal?: string }[];
}

export const openai: ProviderAdapter = {
  async send(req: AIRequest, { key, model }): Promise<AIResult> {
    const body: Record<string, unknown> = {
      model,
      // OpenAI caches long identical prefixes automatically, so the library block needs no flag here
      instructions: req.system.map(s => s.text).join('\n\n'),
      input: req.messages.map(m =>
        typeof m.content === 'string'
          ? { role: m.role, content: m.content }
          : {
              role: m.role,
              content: m.content.map(p =>
                p.type === 'text'
                  ? { type: 'input_text', text: p.text }
                  : { type: 'input_image', image_url: `data:${p.mediaType};base64,${p.base64}`, detail: 'high' },
              ),
            },
      ),
      max_output_tokens: req.maxTokens,
      // Don't keep the request on OpenAI's side for later retrieval
      store: false,
    };
    if (req.tool) {
      body.tools = [{ type: 'function', name: req.tool.name, description: req.tool.description, parameters: req.tool.schema, strict: false }];
      body.tool_choice = { type: 'function', name: req.tool.name };
    }
    if (req.effort && isReasoning(model)) body.reasoning = { effort: req.effort };

    const res = await request(`${BASE}/responses`, { method: 'POST', headers: headers(key), body: JSON.stringify(body) }, LABEL);
    const json = await readJson<{ output?: OutputItem[]; status?: string; incomplete_details?: { reason?: string } }>(res, LABEL);
    if (json.status === 'incomplete') {
      throw new AIError(
        json.incomplete_details?.reason === 'content_filter'
          ? 'OpenAI declined this request. Try rewording it.'
          : 'OpenAI ran out of room for its answer. Try again.',
      );
    }

    const output = json.output ?? [];
    const parts = output.filter(o => o.type === 'message').flatMap(o => o.content ?? []);
    const refusal = parts.find(p => p.type === 'refusal');
    if (refusal) throw new AIError('OpenAI declined this request. Try rewording it.');
    const text = parts.filter(p => p.type === 'output_text').map(p => p.text ?? '').join('\n').trim();
    const call = req.tool ? output.find(o => o.type === 'function_call' && o.name === req.tool!.name) : undefined;
    return { text, toolInput: call ? parseArgs(call.arguments, LABEL) : undefined };
  },

  async listModels(key) {
    const res = await request(`${BASE}/models`, { headers: headers(key) }, LABEL);
    const json = await readJson<{ data?: { id: string }[] }>(res, LABEL);
    return (json.data ?? [])
      .map(m => m.id)
      .filter(id => CHAT_MODEL.test(id) && !NOT_CHAT.test(id))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map((id): ModelOption => ({ id, label: id }));
  },
};
