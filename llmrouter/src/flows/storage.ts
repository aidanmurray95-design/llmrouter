import { storage } from '../utils/storage';

export interface SavedFlow {
  id: string;
  name: string;
  description: string;
  initialInput?: string;
  createdAt: number;
  updatedAt: number;
}

const FLOWS_KEY = 'flows';

export class FlowStorage {
  getAllFlows(): SavedFlow[] {
    const flows = storage.get<SavedFlow[]>(FLOWS_KEY);
    return flows || [];
  }

  getFlow(id: string): SavedFlow | null {
    const flows = this.getAllFlows();
    return flows.find(flow => flow.id === id) || null;
  }

  saveFlow(flow: Omit<SavedFlow, 'id' | 'createdAt' | 'updatedAt'>): SavedFlow {
    const flows = this.getAllFlows();

    const newFlow: SavedFlow = {
      id: this.generateId(),
      ...flow,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    flows.push(newFlow);
    storage.set(FLOWS_KEY, flows);

    return newFlow;
  }

  updateFlow(id: string, updates: Partial<Omit<SavedFlow, 'id' | 'createdAt'>>): SavedFlow | null {
    const flows = this.getAllFlows();
    const index = flows.findIndex(flow => flow.id === id);

    if (index === -1) {
      return null;
    }

    flows[index] = {
      ...flows[index],
      ...updates,
      updatedAt: Date.now(),
    };

    storage.set(FLOWS_KEY, flows);
    return flows[index];
  }

  deleteFlow(id: string): boolean {
    const flows = this.getAllFlows();
    const filtered = flows.filter(flow => flow.id !== id);

    if (filtered.length === flows.length) {
      return false; // Flow not found
    }

    storage.set(FLOWS_KEY, filtered);
    return true;
  }

  exportFlow(id: string): string | null {
    const flow = this.getFlow(id);
    if (!flow) return null;

    return JSON.stringify(flow, null, 2);
  }

  importFlow(json: string): SavedFlow | null {
    try {
      const data = JSON.parse(json) as Partial<SavedFlow>;

      if (!data.name || !data.description) {
        throw new Error('Invalid flow data');
      }

      return this.saveFlow({
        name: data.name,
        description: data.description,
        initialInput: data.initialInput,
      });
    } catch (error) {
      console.error('Error importing flow:', error);
      return null;
    }
  }

  private generateId(): string {
    return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const flowStorage = new FlowStorage();

// Example flows library
export const EXAMPLE_FLOWS: Omit<SavedFlow, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Content Analysis Pipeline',
    description: 'First analyze this text for tone and sentiment, then identify the 3 main themes, then suggest 5 related topics',
    initialInput: 'Enter your content here...',
  },
  {
    name: 'Professional Rewriter',
    description: 'First rewrite this text in a professional tone, then make it more concise without losing meaning, then format it as bullet points',
    initialInput: 'Enter your text here...',
  },
  {
    name: 'Translation Comparison',
    description: 'First translate this to Spanish, then translate the Spanish back to English, then compare the differences between the original and the back-translation',
    initialInput: 'Enter your English text here...',
  },
  {
    name: 'Article to Social Media',
    description: 'First extract the 5 key facts from this article, then create a tweet thread about them, then suggest 5 relevant hashtags',
    initialInput: 'Paste your article here...',
  },
  {
    name: 'Creative Story Builder',
    description: 'First create a character description based on these traits, then write a short scene with this character, then suggest a plot twist',
    initialInput: 'Character traits: brave, curious, clever...',
  },
  {
    name: 'Code Review Flow',
    description: 'First review this code for potential bugs, then suggest performance improvements, then rewrite with best practices',
    initialInput: 'Paste your code here...',
  },
];
