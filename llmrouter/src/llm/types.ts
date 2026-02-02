// Shared types for LLM integrations

export type LLMProvider = 'openai' | 'claude';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export type StreamCallback = (chunk: StreamChunk) => void;

export interface LLMClient {
  chat(request: ChatRequest, onStream?: StreamCallback): Promise<ChatResponse>;
  validateApiKey(): Promise<boolean>;
}

export interface APIConfig {
  openaiApiKey?: string;
  claudeApiKey?: string;
  defaultProvider: LLMProvider;
  openaiModel: string;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public provider: LLMProvider,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}
