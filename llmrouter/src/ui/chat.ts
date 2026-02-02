import type { LLMClient, Message } from '../llm/types';
import { renderMarkdown } from '../utils/markdown';
import type { FileAttachment } from '../types/fileTypes';
import {
  validateFiles,
  readFileAsArrayBuffer,
  createFileAttachment,
  formatFileSize,
  FileUploadError
} from '../utils/fileUpload';
import { parsePDF } from '../parsers/pdfParser';
import { parseExcel } from '../parsers/excelParser';
import { parseModelCommand, getModelDisplayName } from '../utils/modelCommands';
import type { ConfigUI } from './config';

interface ChatMessage extends Message {
  id: string;
  timestamp: number;
  provider?: string;
}

export class ChatUI {
  private messagesContainer: HTMLElement;
  private chatForm: HTMLFormElement;
  private chatInput: HTMLTextAreaElement;
  private fileAttachButton: HTMLButtonElement | null = null;
  private fileInput: HTMLInputElement | null = null;
  private filePreview: HTMLElement | null = null;
  private messages: ChatMessage[] = [];
  private llmClient: LLMClient | null = null;
  private provider: string = 'Unknown';
  private fileAttachments: FileAttachment[] = [];
  private isProcessingFiles: boolean = false;
  private configUI: ConfigUI;

  constructor(configUI: ConfigUI) {
    this.configUI = configUI;
    this.messagesContainer = document.getElementById('chat-messages')!;
    this.chatForm = document.getElementById('chat-form') as HTMLFormElement;
    this.chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;

    this.setupEventListeners();
    this.setupFileUpload();
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

  private setupFileUpload(): void {
    this.fileAttachButton = document.getElementById('chat-file-btn') as HTMLButtonElement;
    this.fileInput = document.getElementById('chat-file-input') as HTMLInputElement;
    this.filePreview = document.getElementById('chat-file-preview');

    if (this.fileAttachButton && this.fileInput) {
      this.fileAttachButton.addEventListener('click', () => {
        this.fileInput?.click();
      });

      this.fileInput.addEventListener('change', (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          this.handleFileSelect(Array.from(files));
        }
      });
    }
  }

  private async handleFileSelect(files: File[]): Promise<void> {
    // Validate files
    const validation = validateFiles(files, this.fileAttachments);
    if (!validation.valid) {
      this.showError(validation.error || 'Invalid files');
      return;
    }

    // Show loading state
    this.isProcessingFiles = true;
    this.updateFileAttachButtonState();

    try {
      // Process each file
      for (const file of files) {
        await this.processFile(file);
      }

      // Render file preview
      this.renderFilePreview();
    } catch (error) {
      this.showError(
        error instanceof FileUploadError
          ? error.message
          : 'Failed to process file. Please try again.'
      );
    } finally {
      this.isProcessingFiles = false;
      this.updateFileAttachButtonState();

      // Clear file input
      if (this.fileInput) {
        this.fileInput.value = '';
      }
    }
  }

  private async processFile(file: File): Promise<void> {
    try {
      // Read file
      const arrayBuffer = await readFileAsArrayBuffer(file);

      // Parse based on file type
      const extension = file.name.split('.').pop()?.toLowerCase();
      let parseResult;

      if (extension === 'pdf') {
        parseResult = await parsePDF(arrayBuffer, file.name);
      } else {
        parseResult = await parseExcel(arrayBuffer, file.name);
      }

      // Check for parsing errors
      if (parseResult.error) {
        throw new FileUploadError(parseResult.error);
      }

      if (!parseResult.content) {
        throw new FileUploadError(`No content could be extracted from ${file.name}`);
      }

      // Create attachment
      const attachment = createFileAttachment(file, parseResult.content, parseResult.metadata);
      this.fileAttachments.push(attachment);
    } catch (error) {
      console.error('File processing error:', error);
      throw error;
    }
  }

  private renderFilePreview(): void {
    if (!this.filePreview) return;

    if (this.fileAttachments.length === 0) {
      this.filePreview.classList.add('hidden');
      this.filePreview.innerHTML = '';
      return;
    }

    this.filePreview.classList.remove('hidden');
    this.filePreview.innerHTML = '';

    this.fileAttachments.forEach((attachment, index) => {
      const chip = document.createElement('div');
      chip.className = 'file-chip';

      const icon = document.createElement('span');
      icon.className = 'file-icon';
      icon.textContent = attachment.type === 'pdf' ? '📄' : '📊';

      const info = document.createElement('div');
      info.className = 'file-info';

      const name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = attachment.name;

      const meta = document.createElement('div');
      meta.className = 'file-meta';
      const sizeText = formatFileSize(attachment.size);
      const metaText = attachment.metadata?.pageCount
        ? `${sizeText} • ${attachment.metadata.pageCount} pages`
        : attachment.metadata?.sheetNames
        ? `${sizeText} • ${attachment.metadata.sheetNames.length} sheets`
        : sizeText;
      meta.textContent = metaText;

      info.appendChild(name);
      info.appendChild(meta);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'file-remove';
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove file';
      removeBtn.addEventListener('click', () => this.removeFileAttachment(index));

      chip.appendChild(icon);
      chip.appendChild(info);
      chip.appendChild(removeBtn);

      this.filePreview!.appendChild(chip);
    });
  }

  private removeFileAttachment(index: number): void {
    this.fileAttachments.splice(index, 1);
    this.renderFilePreview();
  }

  private clearFileAttachments(): void {
    this.fileAttachments = [];
    this.renderFilePreview();
  }

  private updateFileAttachButtonState(): void {
    if (this.fileAttachButton) {
      if (this.isProcessingFiles) {
        this.fileAttachButton.disabled = true;
        this.fileAttachButton.textContent = '⏳';
      } else {
        this.fileAttachButton.disabled = false;
        this.fileAttachButton.textContent = '📎';
      }
    }
  }

  private async handleSendMessage(): Promise<void> {
    const rawContent = this.chatInput.value.trim();

    // Require either content or file attachments
    if (!rawContent && this.fileAttachments.length === 0) return;

    // Parse for @ command
    const parsed = parseModelCommand(rawContent);
    const content = parsed.content;

    // Determine which LLM client to use
    let llmClient = this.llmClient;
    let providerName = this.provider;

    if (parsed.modelOverride) {
      const overrideClient = this.configUI.createSpecificLLMClient(
        parsed.modelOverride.provider,
        parsed.modelOverride.model
      );

      if (overrideClient) {
        llmClient = overrideClient.client;
        providerName = getModelDisplayName(parsed.modelOverride);
      } else {
        this.showError(`${parsed.modelOverride.provider} not configured. Please add API key in settings.`);
        return;
      }
    }

    if (!llmClient) {
      this.showError('Please configure your API keys in settings first.');
      return;
    }

    // Build final message content
    let finalContent = content;

    // Append file content if any
    if (this.fileAttachments.length > 0) {
      const fileContents = this.fileAttachments
        .map(attachment => attachment.extractedContent)
        .join('\n\n');

      if (content) {
        finalContent = `${content}\n\n${fileContents}`;
      } else {
        finalContent = fileContents;
      }
    }

    // Clear input and files
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';
    const attachments = [...this.fileAttachments];
    this.clearFileAttachments();

    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: finalContent,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
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
        provider: providerName,
      };

      let fullContent = '';

      // Send to LLM with streaming (use override client if available)
      await llmClient.chat(
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

    // Show file attachments if any
    if (message.attachments && message.attachments.length > 0) {
      const attachmentsEl = document.createElement('div');
      attachmentsEl.className = 'message-attachments';

      message.attachments.forEach(attachment => {
        const attachmentChip = document.createElement('div');
        attachmentChip.className = 'attachment-chip';
        const icon = attachment.type === 'pdf' ? '📄' : '📊';
        attachmentChip.textContent = `${icon} ${attachment.name}`;
        attachmentsEl.appendChild(attachmentChip);
      });

      header.appendChild(attachmentsEl);
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
