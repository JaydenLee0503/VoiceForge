const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const FEATHERLESS_CHAT_COMPLETIONS_URL = "https://api.featherless.ai/v1/chat/completions";

export const GROQ_PRIMARY_MODEL = "openai/gpt-oss-120b";
export const GROQ_FALLBACK_MODELS = ["llama-3.1-8b-instant", "qwen/qwen3-32b"] as const;
export const FEATHERLESS_PRIMARY_MODEL = "Qwen/Qwen2-72B-Instruct";
export const FEATHERLESS_FALLBACK_MODELS = ["meta-llama/Llama-3.3-70B-Instruct"] as const;
export type LlmProviderId = "featherless" | "groq";

type ChatMessage = {
  content: string;
  role: "system" | "user";
};

type GroqChatCompletionBody = {
  include_reasoning?: boolean;
  max_completion_tokens: number;
  messages: ChatMessage[];
  model: string;
  reasoning_effort?: "low" | "medium" | "high" | "none";
  response_format: {
    type: "json_object";
  };
  temperature: number;
};

type ProviderChatCompletionRequest = {
  apiKeys: string[];
  keyOrderOffset?: number;
  maxCompletionTokens: number;
  messages: ChatMessage[];
  modelPreferences?: readonly string[];
  provider: LlmProviderId;
  temperature?: number;
};

type ProviderChatCompletionResult = {
  content: string;
  model: string;
  provider: LlmProviderId;
};

type ProviderApiResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      reasoning?: string;
    };
  }>;
};

function isGptOssModel(model: string) {
  return model.startsWith("openai/gpt-oss");
}

function isQwenReasoningModel(model: string) {
  return model === "qwen/qwen3-32b";
}

function getProviderLabel(provider: LlmProviderId) {
  return provider === "groq" ? "Groq" : "Featherless";
}

function getProviderUrl(provider: LlmProviderId) {
  return provider === "groq"
    ? GROQ_CHAT_COMPLETIONS_URL
    : FEATHERLESS_CHAT_COMPLETIONS_URL;
}

function buildGroqCompletionBody(
  request: ProviderChatCompletionRequest,
  model: string,
): GroqChatCompletionBody {
  const body: GroqChatCompletionBody = {
    max_completion_tokens: request.maxCompletionTokens,
    messages: buildModelMessages(request.messages, model, "groq"),
    model,
    response_format: {
      type: "json_object",
    },
    temperature: request.temperature ?? 0.25,
  };

  // Reasoning models need explicit controls when JSON mode is enabled.
  if (isGptOssModel(model)) {
    body.include_reasoning = false;
  }

  if (isQwenReasoningModel(model)) {
    body.reasoning_effort = "none";
  }

  return body;
}

function buildModelMessages(
  messages: ChatMessage[],
  model: string,
  provider: LlmProviderId,
): ChatMessage[] {
  if (provider !== "groq" || (!isGptOssModel(model) && !isQwenReasoningModel(model))) {
    return messages;
  }

  if (messages.length === 1 && messages[0]?.role === "user") {
    return messages;
  }

  return [
    {
      content: messages
        .map((message) =>
          `${message.role === "system" ? "Instructions" : "Input"}:\n${message.content}`,
        )
        .join("\n\n"),
      role: "user",
    },
  ];
}

function buildCompletionBody(
  request: ProviderChatCompletionRequest,
  model: string,
) {
  if (request.provider === "featherless") {
    return {
      max_tokens: request.maxCompletionTokens,
      messages: buildModelMessages(request.messages, model, "featherless"),
      model,
      temperature: request.temperature ?? 0.25,
    };
  }

  return buildGroqCompletionBody(request, model);
}

function getDefaultModelPreferences(provider: LlmProviderId) {
  if (provider === "featherless") {
    return [FEATHERLESS_PRIMARY_MODEL, ...FEATHERLESS_FALLBACK_MODELS];
  }

  return [GROQ_PRIMARY_MODEL, ...GROQ_FALLBACK_MODELS];
}

function parseJsonBlock<T>(content: string, provider: LlmProviderId) {
  try {
    return JSON.parse(content) as T;
  } catch {
    const startIndex = content.indexOf("{");
    const endIndex = content.lastIndexOf("}");

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      throw new Error(`${getProviderLabel(provider)} response did not contain a valid JSON object.`);
    }

    return JSON.parse(content.slice(startIndex, endIndex + 1)) as T;
  }
}

async function requestModelCompletion(
  apiKey: string,
  request: ProviderChatCompletionRequest,
  model: string,
): Promise<ProviderChatCompletionResult> {
  const response = await fetch(getProviderUrl(request.provider), {
    body: JSON.stringify(buildCompletionBody(request, model)),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    const errorSuffix = responseBody ? `: ${responseBody}` : "";

    throw new Error(
      `${getProviderLabel(request.provider)} request failed for ${model} with ${response.status}${errorSuffix}`,
    );
  }

  const body = (await response.json()) as ProviderApiResponse;
  const content = body.choices?.[0]?.message?.content?.trim();

  if (!content) {
    const reasoning = body.choices?.[0]?.message?.reasoning?.trim();
    const detail =
      request.provider === "groq" && reasoning
      ? " The model returned reasoning without a final content payload."
      : "";

    throw new Error(
      `${getProviderLabel(request.provider)} response for ${model} did not include message content.${detail}`,
    );
  }

  return {
    content,
    model,
    provider: request.provider,
  };
}

function rotateArray<T>(values: readonly T[], offset = 0) {
  if (values.length <= 1 || offset === 0) {
    return [...values];
  }

  const normalizedOffset = ((offset % values.length) + values.length) % values.length;

  return [
    ...values.slice(normalizedOffset),
    ...values.slice(0, normalizedOffset),
  ];
}

export async function requestGroqJsonWithFallback<T>(
  request: Omit<ProviderChatCompletionRequest, "provider">,
): Promise<T & { model: string }> {
  const response = await requestProviderJsonWithFallback<T>({
    ...request,
    provider: "groq",
  });

  return {
    ...response,
    model: response.model,
  };
}

export async function requestProviderJsonWithFallback<T>(
  request: ProviderChatCompletionRequest,
): Promise<T & { model: string; provider: LlmProviderId }> {
  const errors: string[] = [];
  const modelPreferences = request.modelPreferences ?? getDefaultModelPreferences(request.provider);
  const apiKeys = rotateArray(request.apiKeys, request.keyOrderOffset).filter(Boolean);

  if (apiKeys.length === 0) {
    throw new Error(`At least one ${getProviderLabel(request.provider)} API key is required.`);
  }

  for (const model of modelPreferences) {
    for (const apiKey of apiKeys) {
      try {
        const response = await requestModelCompletion(apiKey, request, model);

        return {
          ...parseJsonBlock<T>(response.content, request.provider),
          model: response.model,
          provider: response.provider,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Unknown ${getProviderLabel(request.provider)} error for ${model}.`;

        errors.push(message);
      }
    }
  }

  throw new Error(errors.join(" | "));
}

export async function requestFeatherlessJsonWithFallback<T>(
  request: Omit<ProviderChatCompletionRequest, "provider">,
): Promise<T & { model: string }> {
  const response = await requestProviderJsonWithFallback<T>({
    ...request,
    provider: "featherless",
  });

  return {
    ...response,
    model: response.model,
  };
}
