import type { LLMProvider } from '../llm/types';

export interface ModelOverride {
  provider: LLMProvider;
  model: string;
  displayName: string;
}

export interface ParsedMessage {
  content: string;           // Message with @ command removed
  modelOverride?: ModelOverride;
}

// Model command mapping
const MODEL_COMMANDS: Record<string, ModelOverride> = {
  // Claude models
  '@claude': {
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet'
  },
  '@sonnet': {
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet'
  },

  // OpenAI models
  '@gpt4': {
    provider: 'openai',
    model: 'gpt-4',
    displayName: 'GPT-4'
  },
  '@gpt-4': {
    provider: 'openai',
    model: 'gpt-4',
    displayName: 'GPT-4'
  },
  '@gpt3.5': {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo'
  },
  '@gpt-3.5': {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo'
  },
  '@gpt4-turbo': {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    displayName: 'GPT-4 Turbo'
  },
};

/**
 * Parses a message for @ command at the beginning
 * Returns the cleaned message and model override if found
 */
export function parseModelCommand(message: string): ParsedMessage {
  // Trim the message
  const trimmed = message.trim();

  // Check if message starts with @ command
  const match = trimmed.match(/^(@[a-zA-Z0-9.-]+)\s+(.+)$/);

  if (!match) {
    // No @ command found or invalid format
    return { content: message };
  }

  const [, command, restOfMessage] = match;
  const normalizedCommand = command.toLowerCase();

  // Look up the model override
  const modelOverride = MODEL_COMMANDS[normalizedCommand];

  if (modelOverride) {
    return {
      content: restOfMessage.trim(),
      modelOverride
    };
  }

  // Unknown @ command - return original message
  return { content: message };
}

/**
 * Checks if a string is a valid model command
 */
export function isValidModelCommand(command: string): boolean {
  const normalized = command.toLowerCase();
  return normalized in MODEL_COMMANDS;
}

/**
 * Gets display name for a model override
 */
export function getModelDisplayName(override: ModelOverride): string {
  return override.displayName;
}

/**
 * Gets all available model commands for help/autocomplete
 */
export function getAvailableCommands(): string[] {
  return Object.keys(MODEL_COMMANDS);
}

/**
 * Gets a formatted help message for model commands
 */
export function getModelCommandsHelp(): string {
  const commands = getAvailableCommands();
  return `Available model commands:\n${commands.join(', ')}`;
}
