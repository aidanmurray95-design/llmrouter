import type { ChatRequest, ChatResponse, LLMClient, StreamCallback, Message } from './types';
import { LLMError } from './types';

export class OpenAIClient implements LLMClient {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(apiKey: string, model: string = 'gpt-4') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(request: ChatRequest, onStream?: StreamCallback): Promise<ChatResponse> {
    if (!this.apiKey) {
      throw new LLMError('OpenAI API key is required', 'openai');
    }

    const { messages, temperature = 0.7, maxTokens = 2000, stream = !!onStream } = request;

    const body = {
      model: this.model,
      messages: messages,
      temperature,
      max_tokens: maxTokens,
      stream,
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new LLMError(
          error.error?.message || 'OpenAI API request failed',
          'openai',
          response.status
        );
      }

      if (stream && onStream) {
        return await this.handleStream(response, onStream);
      } else {
        return await this.handleNonStream(response);
      }
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      throw new LLMError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        'openai'
      );
    }
  }

  private async handleStream(response: Response, onStream: StreamCallback): Promise<ChatResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new LLMError('Response body is not readable', 'openai');
    }

    const decoder = new TextDecoder();
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              onStream({ content: '', done: true });
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';

              if (content) {
                fullContent += content;
                onStream({ content, done: false });
              }
            } catch (e) {
              // Skip invalid JSON chunks
              console.warn('Failed to parse streaming chunk:', e);
            }
          }
        }
      }

      return {
        content: fullContent,
        provider: 'openai',
        model: this.model,
      };
    } finally {
      reader.releaseLock();
    }
  }

  private async handleNonStream(response: Response): Promise<ChatResponse> {
    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      provider: 'openai',
      model: this.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  updateModel(model: string): void {
    this.model = model;
  }
}
