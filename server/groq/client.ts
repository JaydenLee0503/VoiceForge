const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

export const GROQ_PRIMARY_MODEL = "openai/gpt-oss-120b";
export const GROQ_FALLBACK_MODELS = ["llama-3.1-8b-instant", "qwen/qwen3-32b"] as const;

type GroqChatMessage = {
  content: string;
  role: "system" | "user";
};

type GroqChatCompletionBody = {
  include_reasoning?: boolean;
  max_completion_tokens: number;
  messages: GroqChatMessage[];
  model: string;
  reasoning_effort?: "low" | "medium" | "high" | "none";
  response_format: {
    type: "json_object";
  };
  temperature: number;
};

type GroqChatCompletionRequest = {
  apiKeys: string[];
  keyOrderOffset?: number;
  maxCompletionTokens: number;
  messages: GroqChatMessage[];
  modelPreferences?: readonly string[];
  temperature?: number;
};

type GroqChatCompletionResult = {
  content: string;
  model: string;
};

type GroqApiResponse = {
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

function buildCompletionBody(
  request: GroqChatCompletionRequest,
  model: string,
): GroqChatCompletionBody {
  const body: GroqChatCompletionBody = {
    max_completion_tokens: request.maxCompletionTokens,
    messages: buildModelMessages(request.messages, model),
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
  messages: GroqChatMessage[],
  model: string,
): GroqChatMessage[] {
  if (!isGptOssModel(model) && !isQwenReasoningModel(model)) {
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

function parseJsonBlock<T>(content: string) {
  try {
    return JSON.parse(content) as T;
  } catch {
    const startIndex = content.indexOf("{");
    const endIndex = content.lastIndexOf("}");

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      throw new Error("Groq response did not contain a valid JSON object.");
    }

    return JSON.parse(content.slice(startIndex, endIndex + 1)) as T;
  }
}

async function requestModelCompletion(
  apiKey: string,
  request: GroqChatCompletionRequest,
  model: string,
): Promise<GroqChatCompletionResult> {
  const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
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

    throw new Error(`Groq request failed for ${model} with ${response.status}${errorSuffix}`);
  }

  const body = (await response.json()) as GroqApiResponse;
  const content = body.choices?.[0]?.message?.content?.trim();

  if (!content) {
    const reasoning = body.choices?.[0]?.message?.reasoning?.trim();
    const detail = reasoning
      ? " The model returned reasoning without a final content payload."
      : "";

    throw new Error(`Groq response for ${model} did not include message content.${detail}`);
  }

  return {
    content,
    model,
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
  request: GroqChatCompletionRequest,
): Promise<T & { model: string }> {
  const errors: string[] = [];
  const modelPreferences =
    request.modelPreferences ?? [GROQ_PRIMARY_MODEL, ...GROQ_FALLBACK_MODELS];
  const apiKeys = rotateArray(request.apiKeys, request.keyOrderOffset).filter(Boolean);

  if (apiKeys.length === 0) {
    throw new Error("At least one Groq API key is required.");
  }

  for (const model of modelPreferences) {
    for (const apiKey of apiKeys) {
      try {
        const response = await requestModelCompletion(apiKey, request, model);

        return {
          ...parseJsonBlock<T>(response.content),
          model: response.model,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : `Unknown Groq error for ${model}.`;

        errors.push(message);
      }
    }
  }

  throw new Error(errors.join(" | "));
}
