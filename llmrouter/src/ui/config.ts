import type { APIConfig, LLMProvider } from '../llm/types';
import { storage } from '../utils/storage';
import { OpenAIClient } from '../llm/openai';
import { ClaudeClient } from '../llm/claude';

const CONFIG_KEY = 'api_config';

export class ConfigUI {
  private modal: HTMLElement;
  private settingsBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;
  private openaiKeyInput: HTMLInputElement;
  private claudeKeyInput: HTMLInputElement;
  private defaultProviderSelect: HTMLSelectElement;
  private openaiModelSelect: HTMLSelectElement;
  private saveSettingsBtn: HTMLButtonElement;
  private clearDataBtn: HTMLButtonElement;

  private config: APIConfig;
  private onConfigChange?: (config: APIConfig) => void;

  constructor(onConfigChange?: (config: APIConfig) => void) {
    this.modal = document.getElementById('settings-modal')!;
    this.settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
    this.closeBtn = document.getElementById('close-settings') as HTMLButtonElement;
    this.openaiKeyInput = document.getElementById('openai-key') as HTMLInputElement;
    this.claudeKeyInput = document.getElementById('claude-key') as HTMLInputElement;
    this.defaultProviderSelect = document.getElementById('default-provider') as HTMLSelectElement;
    this.openaiModelSelect = document.getElementById('openai-model') as HTMLSelectElement;
    this.saveSettingsBtn = document.getElementById('save-settings-btn') as HTMLButtonElement;
    this.clearDataBtn = document.getElementById('clear-data-btn') as HTMLButtonElement;

    this.onConfigChange = onConfigChange;

    // Load existing config or use defaults
    this.config = this.loadConfig();

    this.setupEventListeners();
    this.loadFormValues();
  }

  private setupEventListeners(): void {
    this.settingsBtn.addEventListener('click', () => this.openModal());
    this.closeBtn.addEventListener('click', () => this.closeModal());

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });

    this.saveSettingsBtn.addEventListener('click', () => this.handleSaveSettings());
    this.clearDataBtn.addEventListener('click', () => this.handleClearData());

    // Also handle configure-apis button from welcome message
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'configure-apis') {
        this.openModal();
      }
    });
  }

  private openModal(): void {
    this.modal.classList.remove('hidden');
    this.loadFormValues();
  }

  closeModal(): void {
    this.modal.classList.add('hidden');
  }

  private loadFormValues(): void {
    this.openaiKeyInput.value = this.config.openaiApiKey || '';
    this.claudeKeyInput.value = this.config.claudeApiKey || '';
    this.defaultProviderSelect.value = this.config.defaultProvider;
    this.openaiModelSelect.value = this.config.openaiModel;
  }

  private handleSaveSettings(): void {
    const openaiKey = this.openaiKeyInput.value.trim();
    const claudeKey = this.claudeKeyInput.value.trim();
    const defaultProvider = this.defaultProviderSelect.value as LLMProvider;
    const openaiModel = this.openaiModelSelect.value;

    if (!openaiKey && !claudeKey) {
      this.showError('Please provide at least one API key');
      return;
    }

    // Update config
    this.config = {
      openaiApiKey: openaiKey || undefined,
      claudeApiKey: claudeKey || undefined,
      defaultProvider,
      openaiModel,
    };

    // Save to storage
    this.saveConfig(this.config);

    // Notify parent
    if (this.onConfigChange) {
      this.onConfigChange(this.config);
    }

    this.showSuccess('Settings saved successfully');
    setTimeout(() => this.closeModal(), 1000);
  }

  private handleClearData(): void {
    if (confirm('Are you sure you want to clear all data? This will remove all saved flows and API keys.')) {
      storage.clear();
      this.config = this.getDefaultConfig();
      this.loadFormValues();
      this.showSuccess('All data cleared');

      if (this.onConfigChange) {
        this.onConfigChange(this.config);
      }
    }
  }

  private loadConfig(): APIConfig {
    const saved = storage.get<APIConfig>(CONFIG_KEY);
    return saved || this.getDefaultConfig();
  }

  private saveConfig(config: APIConfig): void {
    storage.set(CONFIG_KEY, config);
  }

  private getDefaultConfig(): APIConfig {
    return {
      defaultProvider: 'claude',
      openaiModel: 'gpt-4',
    };
  }

  private showError(message: string): void {
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = message;

    const modalBody = this.modal.querySelector('.modal-body');
    if (modalBody) {
      modalBody.insertBefore(errorEl, modalBody.firstChild);
      setTimeout(() => errorEl.remove(), 5000);
    }
  }

  private showSuccess(message: string): void {
    const successEl = document.createElement('div');
    successEl.className = 'success-message';
    successEl.textContent = message;

    const modalBody = this.modal.querySelector('.modal-body');
    if (modalBody) {
      modalBody.insertBefore(successEl, modalBody.firstChild);
      setTimeout(() => successEl.remove(), 3000);
    }
  }

  getConfig(): APIConfig {
    return this.config;
  }

  hasValidConfig(): boolean {
    return !!(this.config.openaiApiKey || this.config.claudeApiKey);
  }

  createLLMClient() {
    const provider = this.config.defaultProvider;

    if (provider === 'openai' && this.config.openaiApiKey) {
      return {
        client: new OpenAIClient(this.config.openaiApiKey, this.config.openaiModel),
        provider: 'OpenAI (' + this.config.openaiModel + ')',
      };
    } else if (provider === 'claude' && this.config.claudeApiKey) {
      return {
        client: new ClaudeClient(this.config.claudeApiKey),
        provider: 'Claude 3.5 Sonnet',
      };
    } else {
      // Fallback to whichever key is available
      if (this.config.openaiApiKey) {
        return {
          client: new OpenAIClient(this.config.openaiApiKey, this.config.openaiModel),
          provider: 'OpenAI (' + this.config.openaiModel + ')',
        };
      } else if (this.config.claudeApiKey) {
        return {
          client: new ClaudeClient(this.config.claudeApiKey),
          provider: 'Claude 3.5 Sonnet',
        };
      }
    }

    return null;
  }
}
