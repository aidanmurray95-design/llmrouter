import type { ChatRequest, ChatResponse, LLMClient, StreamCallback } from './types';
import { LLMError } from './types';

export class ClaudeClient implements LLMClient {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20240620') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(request: ChatRequest, onStream?: StreamCallback): Promise<ChatResponse> {
    if (!this.apiKey) {
      throw new LLMError('Anthropic API key is required', 'claude');
    }

    const { messages, temperature = 0.7, maxTokens = 2000, stream = !!onStream } = request;

    // Convert messages to Claude format (extract system messages)
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model: this.model,
      messages: conversationMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      system: systemMessages.length > 0 ? systemMessages[0].content : undefined,
      temperature,
      max_tokens: maxTokens,
      stream,
    };

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new LLMError(
          error.error?.message || 'Anthropic API request failed',
          'claude',
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
        'claude'
      );
    }
  }

  private async handleStream(response: Response, onStream: StreamCallback): Promise<ChatResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new LLMError('Response body is not readable', 'claude');
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

            try {
              const parsed = JSON.parse(data);

              // Handle different event types
              if (parsed.type === 'content_block_delta') {
                const content = parsed.delta?.text || '';
                if (content) {
                  fullContent += content;
                  onStream({ content, done: false });
                }
              } else if (parsed.type === 'message_stop') {
                onStream({ content: '', done: true });
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
        provider: 'claude',
        model: this.model,
      };
    } finally {
      reader.releaseLock();
    }
  }

  private async handleNonStream(response: Response): Promise<ChatResponse> {
    const data = await response.json();

    // Extract text from content array
    const content = data.content?.[0]?.text || '';

    return {
      content,
      provider: 'claude',
      model: this.model,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Make a minimal request to validate the key
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
      });
      return response.ok || response.status === 400; // 400 is ok, means key is valid but request is bad
    } catch {
      return false;
    }
  }

  updateModel(model: string): void {
    this.model = model;
  }
}
