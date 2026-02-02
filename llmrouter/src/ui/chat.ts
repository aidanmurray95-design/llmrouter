import type { LLMClient, Message } from '../llm/types';
import { renderMarkdown } from '../utils/markdown';

interface ChatMessage extends Message {
  id: string;
  timestamp: number;
  provider?: string;
}

export class ChatUI {
  private messagesContainer: HTMLElement;
  private chatForm: HTMLFormElement;
  private chatInput: HTMLTextAreaElement;
  private messages: ChatMessage[] = [];
  private llmClient: LLMClient | null = null;
  private provider: string = 'Unknown';

  constructor() {
    this.messagesContainer = document.getElementById('chat-messages')!;
    this.chatForm = document.getElementById('chat-form') as HTMLFormElement;
    this.chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Handle form submission
    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSendMessage();
    });

    // Auto-resize textarea
    this.chatInput.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = this.chatInput.scrollHeight + 'px';
    });

    // Handle Enter key (submit) vs Shift+Enter (new line)
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });
  }

  private async handleSendMessage(): Promise<void> {
    const content = this.chatInput.value.trim();
    if (!content) return;

    if (!this.llmClient) {
      this.showError('Please configure your API keys in settings first.');
      return;
    }

    // Clear input
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';

    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.addMessage(userMessage);

    // Show typing indicator
    const typingId = this.showTypingIndicator();

    try {
      // Prepare messages for API
      const apiMessages = this.messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Create assistant message placeholder
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        provider: this.provider,
      };

      let fullContent = '';

      // Send to LLM with streaming
      await this.llmClient.chat(
        {
          messages: apiMessages,
          stream: true,
        },
        (chunk) => {
          if (!chunk.done) {
            fullContent += chunk.content;
            assistantMessage.content = fullContent;
            this.updateStreamingMessage(assistantMessage);
          }
        }
      );

      // Remove typing indicator
      this.removeTypingIndicator(typingId);

      // Add final message to history
      this.messages.push(assistantMessage);
    } catch (error) {
      this.removeTypingIndicator(typingId);
      this.showError(
        error instanceof Error ? error.message : 'Failed to get response from LLM'
      );
    }
  }

  private addMessage(message: ChatMessage): void {
    // Remove welcome message if exists
    const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }

    this.messages.push(message);
    this.renderMessage(message);
    this.scrollToBottom();
  }

  private renderMessage(message: ChatMessage): void {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.role}`;
    messageEl.dataset.messageId = message.id;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = message.role === 'user' ? '👤' : '🤖';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';

    const header = document.createElement('div');
    header.className = 'message-header';

    const sender = document.createElement('div');
    sender.className = 'message-sender';
    sender.textContent = message.role === 'user' ? 'You' : 'Assistant';

    header.appendChild(sender);

    if (message.provider) {
      const providerBadge = document.createElement('div');
      providerBadge.className = 'message-provider';
      providerBadge.textContent = message.provider;
      header.appendChild(providerBadge);
    }

    const text = document.createElement('div');
    text.className = 'message-text';
    text.innerHTML = renderMarkdown(message.content);

    contentWrapper.appendChild(header);
    contentWrapper.appendChild(text);

    messageEl.appendChild(avatar);
    messageEl.appendChild(contentWrapper);

    this.messagesContainer.appendChild(messageEl);
  }

  private updateStreamingMessage(message: ChatMessage): void {
    const existingMessage = this.messagesContainer.querySelector(
      `[data-message-id="${message.id}"]`
    );

    if (existingMessage) {
      const textEl = existingMessage.querySelector('.message-text');
      if (textEl) {
        textEl.innerHTML = renderMarkdown(message.content);
      }
    } else {
      this.renderMessage(message);
    }

    this.scrollToBottom();
  }

  private showTypingIndicator(): string {
    const id = this.generateId();
    const indicator = document.createElement('div');
    indicator.className = 'message assistant';
    indicator.dataset.messageId = id;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';

    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;

    contentWrapper.appendChild(typingIndicator);
    indicator.appendChild(avatar);
    indicator.appendChild(contentWrapper);

    this.messagesContainer.appendChild(indicator);
    this.scrollToBottom();

    return id;
  }

  private removeTypingIndicator(id: string): void {
    const indicator = this.messagesContainer.querySelector(`[data-message-id="${id}"]`);
    if (indicator) {
      indicator.remove();
    }
  }

  private showError(message: string): void {
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = `Error: ${message}`;

    this.messagesContainer.appendChild(errorEl);
    this.scrollToBottom();

    setTimeout(() => {
      errorEl.remove();
    }, 5000);
  }

  private scrollToBottom(): void {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setLLMClient(client: LLMClient, provider: string): void {
    this.llmClient = client;
    this.provider = provider;
  }

  clearMessages(): void {
    this.messages = [];
    this.messagesContainer.innerHTML = `
      <div class="welcome-message">
        <h2>Welcome to Multi-LLM Chatbot! 👋</h2>
        <p>Start chatting or create a flow to chain multiple prompts together.</p>
        <div class="quick-actions">
          <button class="btn-secondary" id="try-example-flow">Try Example Flow</button>
          <button class="btn-secondary" id="configure-apis">Configure APIs</button>
        </div>
      </div>
    `;
  }
}
