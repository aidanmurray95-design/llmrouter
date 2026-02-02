import { ChatUI } from './ui/chat';
import { FlowsUI } from './ui/flows';
import { ConfigUI } from './ui/config';
import { EXAMPLE_FLOWS, flowStorage } from './flows/storage';
import type { APIConfig } from './llm/types';

class App {
  private chatUI: ChatUI;
  private flowsUI: FlowsUI;
  private configUI: ConfigUI;

  constructor() {
    // Initialize UI components
    this.configUI = new ConfigUI((config) => this.handleConfigChange(config));
    this.chatUI = new ChatUI(this.configUI);
    this.flowsUI = new FlowsUI();

    // Setup tab navigation
    this.setupTabNavigation();

    // Setup quick actions
    this.setupQuickActions();

    // Initialize with saved config
    this.initializeWithConfig();

    // Load example flows if none exist
    this.loadExampleFlowsIfNeeded();
  }

  private setupTabNavigation(): void {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tabName = (button as HTMLElement).dataset.tab;

        // Update active tab button
        tabButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');

        // Update active tab content
        tabContents.forEach((content) => {
          content.classList.remove('active');
        });

        const activeContent = document.getElementById(`${tabName}-tab`);
        if (activeContent) {
          activeContent.classList.add('active');
        }
      });
    });
  }

  private setupQuickActions(): void {
    // Try example flow button
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'try-example-flow') {
        this.flowsUI.loadExampleFlow();
      }
    });
  }

  private initializeWithConfig(): void {
    const config = this.configUI.getConfig();

    if (this.configUI.hasValidConfig()) {
      this.updateLLMClients(config);
    }
  }

  private handleConfigChange(config: APIConfig): void {
    this.updateLLMClients(config);
  }

  private updateLLMClients(_config: APIConfig): void {
    const clientInfo = this.configUI.createLLMClient();

    if (clientInfo) {
      this.chatUI.setLLMClient(clientInfo.client, clientInfo.provider);
      this.flowsUI.setLLMClient(clientInfo.client);
    }
  }

  private loadExampleFlowsIfNeeded(): void {
    const existingFlows = flowStorage.getAllFlows();

    // If no flows exist, add a couple of examples
    if (existingFlows.length === 0) {
      // Add first 3 example flows
      EXAMPLE_FLOWS.slice(0, 3).forEach((example) => {
        flowStorage.saveFlow(example);
      });

      // Refresh the flows list
      this.flowsUI.loadFlowsList();
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new App();
  });
} else {
  new App();
}
