// The AI provider layer. Everything else in the app calls askAI() and never talks to a provider directly.
// To add a provider: write an adapter (see anthropic.ts), add it to PROVIDERS, add its key slot in store.ts,
// and add its API host to ALLOWED_URLS in eslint.config.js.
import { getKey, getSettings, saveSettings, Settings } from '../../storage/store';
import { anthropic } from './anthropic';
import { deepseek } from './deepseek';
import { gemini } from './gemini';
import { openai } from './openai';
import { AIError, AIRequest, AIResult, ModelOption, ProviderAdapter, ProviderId } from './types';

export * from './types';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  company: string;
  /** Model used until the user picks one. Change defaults here only. */
  defaultModel: string;
  keyPlaceholder: string;
  /** Where to create a key */
  keyUrl: string;
  /** Plain-language cost and privacy note shown in Settings */
  note: string;
  /** Extra privacy warning shown next to the posture photos, if this provider needs one */
  photoWarning?: string;
  /** Whether a model can read images. Missing = all of this provider's chat models can. */
  readsPhotos?: (model: string) => boolean;
  adapter: ProviderAdapter;
}

// Order = order shown in Settings. Gemini first: it has a free tier, so it is the easiest start.
export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    company: 'Google',
    defaultModel: 'gemini-4-hydrogen',
    keyPlaceholder: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
    note:
      'Has a free tier (with usage limits). On the free tier Google may use what you send, including posture photos, to improve its products. A paid Google AI plan avoids this.',
    photoWarning:
      "On Gemini's free tier, Google may use what you send, including these photos, to improve its products. Skip the photos or use a paid plan if that matters to you.",
    adapter: gemini,
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    company: 'Anthropic',
    defaultModel: 'claude-sonnet-5-5',
    keyPlaceholder: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    note: 'Paid API, billed by Anthropic. Separate from a Claude Pro subscription.',
    adapter: anthropic,
  },
  openai: {
    id: 'openai',
    label: 'ChatGPT',
    company: 'OpenAI',
    defaultModel: 'gpt-6.1-sol',
    keyPlaceholder: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    note: 'Paid API, billed by OpenAI. Separate from a ChatGPT Plus subscription.',
    adapter: openai,
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    company: 'DeepSeek',
    // Flash is the cheaper model and the only one that reads posture photos
    defaultModel: 'deepseek-flash',
    keyPlaceholder: 'sk-…',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note:
      'Paid API with low prices, billed by DeepSeek. DeepSeek stores what you send on servers in China, and its privacy policy allows using it to improve its models.',
    photoWarning:
      'DeepSeek stores what you send, including these photos, in China and may use it to improve its models. Skip the photos if that matters to you.',
    // deepseek-v4-pro is text only
    readsPhotos: model => !/pro/i.test(model),
    adapter: deepseek,
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

/** New users start on Gemini, the free option. */
export const DEFAULT_PROVIDER: ProviderId = 'gemini';

export const currentProvider = (s: Settings): ProviderInfo => PROVIDERS[s.aiProvider ?? DEFAULT_PROVIDER];

/**
 * Settings with a provider always chosen. Older installs only supported Claude and never saved a choice:
 * if they have a Claude key, keep them on Claude instead of switching them to the new default.
 */
export async function settingsWithProvider(): Promise<Settings> {
  const s = await getSettings();
  if (s.aiProvider) return s;
  const aiProvider: ProviderId = (await getKey('anthropic')) ? 'anthropic' : DEFAULT_PROVIDER;
  await saveSettings({ aiProvider });
  return { ...s, aiProvider };
}
export const currentModel = (s: Settings): string => {
  const p = currentProvider(s);
  return s.aiModels?.[p.id] || p.defaultModel;
};

/** Whether the chosen provider and model can read posture photos. */
export const modelReadsPhotos = (s: Settings): boolean => currentProvider(s).readsPhotos?.(currentModel(s)) ?? true;

/** Sends a request to the user's chosen provider and model. */
export async function askAI(req: AIRequest): Promise<AIResult> {
  const settings = await settingsWithProvider();
  const provider = currentProvider(settings);
  const key = await getKey(provider.id);
  if (!key) throw new AIError(`Add your ${provider.label} API key in Settings first.`);
  const result = await provider.adapter.send(req, { key, model: currentModel(settings) });
  if (req.tool && !result.toolInput) {
    throw new AIError(`${provider.label} didn't return a usable answer. Try again, or try another model in Settings.`);
  }
  return result;
}

/** Live model list from the provider, using the user's key. */
export async function listModels(id: ProviderId): Promise<ModelOption[]> {
  const key = await getKey(id);
  if (!key) throw new AIError(`Add your ${PROVIDERS[id].label} API key first.`);
  return PROVIDERS[id].adapter.listModels(key);
}

/** A tiny request to check the key and model work. */
export async function testConnection(): Promise<string> {
  const r = await askAI({
    system: [{ text: 'You are a connection test. Reply with exactly: OK' }],
    messages: [{ role: 'user', content: 'Test' }],
    maxTokens: 2000,
    effort: 'low',
  });
  return r.text || 'OK';
}
