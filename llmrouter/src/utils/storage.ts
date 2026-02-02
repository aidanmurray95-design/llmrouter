// LocalStorage wrapper with type safety and error handling

export class Storage {
  private prefix: string;

  constructor(prefix: string = 'chatbot_flows_') {
    this.prefix = prefix;
  }

  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (item === null) return null;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Error reading from storage (key: ${key}):`, error);
      return null;
    }
  }

  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing to storage (key: ${key}):`, error);
      return false;
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.error(`Error removing from storage (key: ${key}):`, error);
    }
  }

  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  has(key: string): boolean {
    return localStorage.getItem(this.prefix + key) !== null;
  }

  keys(): string[] {
    try {
      const allKeys = Object.keys(localStorage);
      return allKeys
        .filter(key => key.startsWith(this.prefix))
        .map(key => key.slice(this.prefix.length));
    } catch (error) {
      console.error('Error getting storage keys:', error);
      return [];
    }
  }
}

export const storage = new Storage();
