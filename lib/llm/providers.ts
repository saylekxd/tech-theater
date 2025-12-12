// ============================================================================
// LLM PROVIDERS CONFIGURATION
// ============================================================================
// Konfiguracja różnych providerów LLM (OpenAI, Anthropic, Groq)

/**
 * Dostępne providery LLM
 */
export type LLMProvider = 'openai' | 'anthropic' | 'groq';

/**
 * Konfiguracja modeli dla różnych providerów
 */
export const LLM_MODELS = {
  openai: {
    'gpt-5.2': {
      name: 'GPT-5.2',
      description: 'Najnowszy model OpenAI (11.12.2025)',
      maxTokens: 16384,
      costPer1kTokens: 0.015, // Estimated
      recommended: true,
    },
    'gpt-5.1': {
      name: 'GPT-5.1',
      description: 'Previous GPT-5 version',
      maxTokens: 16384,
      costPer1kTokens: 0.012,
      recommended: false,
    },
    'gpt-4o': {
      name: 'GPT-4o',
      description: 'Optimized GPT-4',
      maxTokens: 16384,
      costPer1kTokens: 0.010,
      recommended: false,
    },
    'gpt-4-turbo': {
      name: 'GPT-4 Turbo',
      description: 'Fast GPT-4 variant',
      maxTokens: 16384,
      costPer1kTokens: 0.010,
      recommended: false,
    },
    'gpt-3.5-turbo': {
      name: 'GPT-3.5 Turbo',
      description: 'Fast and cheap (fallback)',
      maxTokens: 4096,
      costPer1kTokens: 0.002,
      recommended: false,
    },
  },
  anthropic: {
    'claude-3-opus': {
      name: 'Claude 3 Opus',
      description: 'Best Claude model (excellent for roleplaying)',
      maxTokens: 200000,
      costPer1kTokens: 0.015,
      recommended: true,
    },
    'claude-3-sonnet': {
      name: 'Claude 3 Sonnet',
      description: 'Balanced Claude model',
      maxTokens: 200000,
      costPer1kTokens: 0.003,
      recommended: false,
    },
    'claude-3-haiku': {
      name: 'Claude 3 Haiku',
      description: 'Fast and cheap Claude',
      maxTokens: 200000,
      costPer1kTokens: 0.00025,
      recommended: false,
    },
  },
  groq: {
    'llama-3.1-70b': {
      name: 'Llama 3.1 70B',
      description: 'Fast inference on Groq',
      maxTokens: 8192,
      costPer1kTokens: 0.0005,
      recommended: true,
    },
    'mixtral-8x7b': {
      name: 'Mixtral 8x7B',
      description: 'Fast and efficient',
      maxTokens: 32768,
      costPer1kTokens: 0.0002,
      recommended: false,
    },
  },
} as const;

/**
 * Pobierz rekomendowany model dla providera
 */
export function getRecommendedModel(provider: LLMProvider): string {
  const models = LLM_MODELS[provider];
  const recommended = Object.entries(models).find(([_, config]) => config.recommended);
  return recommended ? recommended[0] : Object.keys(models)[0];
}

/**
 * Sprawdź czy model jest dostępny
 */
export function isModelAvailable(provider: LLMProvider, model: string): boolean {
  return model in LLM_MODELS[provider];
}

/**
 * Pobierz informacje o modelu
 */
export function getModelInfo(provider: LLMProvider, model: string) {
  const models = LLM_MODELS[provider];
  return models[model as keyof typeof models];
}

