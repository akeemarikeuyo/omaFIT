// Google Gemini (generateContent, stateless). Docs: https://ai.google.dev/gemini-api/docs
import { AIError, AIRequest, AIResult, ModelOption, ProviderAdapter, readJson, request } from './types';

const LABEL = 'Gemini';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

const headers = (key: string) => ({ 'content-type': 'application/json', 'x-goog-api-key': key });

// Thinking levels are supported from Gemini 3 on; older models error on them
const supportsThinkingLevel = (model: string) => /^gemini-([3-9]|\d\d)/.test(model);
const NOT_CHAT = /(tts|image|live|embedding|transcribe|aqa|robotics|translate|banana|veo|imagen|lyria)/;

interface Part {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args?: unknown };
}

export const gemini: ProviderAdapter = {
  async send(req: AIRequest, { key, model }): Promise<AIResult> {
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: req.system.map(s => s.text).join('\n\n') }] },
      contents: req.messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts:
          typeof m.content === 'string'
            ? [{ text: m.content }]
            : m.content.map(p => (p.type === 'text' ? { text: p.text } : { inlineData: { mimeType: p.mediaType, data: p.base64 } })),
      })),
      generationConfig: {
        maxOutputTokens: req.maxTokens,
        ...(req.effort && supportsThinkingLevel(model) ? { thinkingConfig: { thinkingLevel: req.effort.toUpperCase() } } : {}),
      },
    };
    if (req.tool) {
      body.tools = [{ functionDeclarations: [{ name: req.tool.name, description: req.tool.description, parametersJsonSchema: req.tool.schema }] }];
      body.toolConfig = { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [req.tool.name] } };
    }

    const url = `${BASE}/models/${encodeURIComponent(model)}:generateContent`;
    const res = await request(url, { method: 'POST', headers: headers(key), body: JSON.stringify(body) }, LABEL);
    const json = await readJson<{
      candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    }>(res, LABEL);

    if (json.promptFeedback?.blockReason) throw new AIError('Gemini declined this request. Try rewording it.');
    const cand = json.candidates?.[0];
    if (cand?.finishReason === 'MAX_TOKENS') throw new AIError('Gemini ran out of room for its answer. Try again.');
    if (cand?.finishReason && /SAFETY|PROHIBITED|BLOCKLIST|SPII/.test(cand.finishReason)) {
      throw new AIError('Gemini declined this request. Try rewording it.');
    }
    const parts = cand?.content?.parts ?? [];
    const text = parts.filter(p => p.text && !p.thought).map(p => p.text).join('\n').trim();
    const call = req.tool ? parts.find(p => p.functionCall?.name === req.tool!.name)?.functionCall : undefined;
    return { text, toolInput: call?.args };
  },

  async listModels(key) {
    const res = await request(`${BASE}/models?pageSize=200`, { headers: headers(key) }, LABEL);
    const json = await readJson<{ models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] }>(res, LABEL);
    return (json.models ?? [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }))
      .filter(m => m.id.startsWith('gemini') && !NOT_CHAT.test(m.id))
      .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true })) as ModelOption[];
  },
};
