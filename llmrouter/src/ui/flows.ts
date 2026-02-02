import type { LLMClient } from '../llm/types';
import { parseFlowDescription, validateFlow } from '../flows/parser';
import { FlowExecutor, type FlowExecution } from '../flows/executor';
import { flowStorage, type SavedFlow, EXAMPLE_FLOWS } from '../flows/storage';
import { renderMarkdown } from '../utils/markdown';

export class FlowsUI {
  private flowNameInput: HTMLInputElement;
  private flowDescriptionInput: HTMLTextAreaElement;
  private flowInputInput: HTMLTextAreaElement;
  private saveFlowBtn: HTMLButtonElement;
  private executeFlowBtn: HTMLButtonElement;
  private flowProgressContainer: HTMLElement;
  private progressFill: HTMLElement;
  private flowStepsStatus: HTMLElement;
  private flowResultsContainer: HTMLElement;
  private flowOutput: HTMLElement;
  private flowsList: HTMLElement;
  private newFlowBtn: HTMLButtonElement;

  private llmClient: LLMClient | null = null;
  private executor: FlowExecutor | null = null;
  private currentFlow: SavedFlow | null = null;

  constructor() {
    this.flowNameInput = document.getElementById('flow-name') as HTMLInputElement;
    this.flowDescriptionInput = document.getElementById('flow-description') as HTMLTextAreaElement;
    this.flowInputInput = document.getElementById('flow-input') as HTMLTextAreaElement;
    this.saveFlowBtn = document.getElementById('save-flow-btn') as HTMLButtonElement;
    this.executeFlowBtn = document.getElementById('execute-flow-btn') as HTMLButtonElement;
    this.flowProgressContainer = document.getElementById('flow-progress') as HTMLElement;
    this.progressFill = document.getElementById('progress-fill') as HTMLElement;
    this.flowStepsStatus = document.getElementById('flow-steps-status') as HTMLElement;
    this.flowResultsContainer = document.getElementById('flow-results') as HTMLElement;
    this.flowOutput = document.getElementById('flow-output') as HTMLElement;
    this.flowsList = document.getElementById('flows-list') as HTMLElement;
    this.newFlowBtn = document.getElementById('new-flow-btn') as HTMLButtonElement;

    this.setupEventListeners();
    this.loadFlowsList();
  }

  private setupEventListeners(): void {
    this.saveFlowBtn.addEventListener('click', () => this.handleSaveFlow());
    this.executeFlowBtn.addEventListener('click', () => this.handleExecuteFlow());
    this.newFlowBtn.addEventListener('click', () => this.handleNewFlow());
  }

  private handleNewFlow(): void {
    this.currentFlow = null;
    this.flowNameInput.value = '';
    this.flowDescriptionInput.value = '';
    this.flowInputInput.value = '';
    this.hideProgress();
    this.hideResults();
  }

  private handleSaveFlow(): void {
    const name = this.flowNameInput.value.trim();
    const description = this.flowDescriptionInput.value.trim();
    const initialInput = this.flowInputInput.value.trim();

    if (!name) {
      this.showError('Please enter a flow name');
      return;
    }

    if (!description) {
      this.showError('Please enter flow steps');
      return;
    }

    // Validate flow
    const parsed = parseFlowDescription(description);
    const validation = validateFlow(parsed);

    if (!validation.valid) {
      this.showError(validation.error || 'Invalid flow');
      return;
    }

    // Save or update flow
    if (this.currentFlow) {
      const updated = flowStorage.updateFlow(this.currentFlow.id, {
        name,
        description,
        initialInput,
      });
      if (updated) {
        this.currentFlow = updated;
        this.showSuccess('Flow updated successfully');
      }
    } else {
      const saved = flowStorage.saveFlow({ name, description, initialInput });
      this.currentFlow = saved;
      this.showSuccess('Flow saved successfully');
    }

    this.loadFlowsList();
  }

  private async handleExecuteFlow(): Promise<void> {
    if (!this.llmClient || !this.executor) {
      this.showError('Please configure your API keys in settings first');
      return;
    }

    const description = this.flowDescriptionInput.value.trim();
    const initialInput = this.flowInputInput.value.trim();

    if (!description) {
      this.showError('Please enter flow steps');
      return;
    }

    if (!initialInput) {
      this.showError('Please enter initial input');
      return;
    }

    // Parse and validate flow
    const parsed = parseFlowDescription(description);
    const validation = validateFlow(parsed);

    if (!validation.valid) {
      this.showError(validation.error || 'Invalid flow');
      return;
    }

    // Show progress
    this.showProgress(parsed.steps.length);
    this.hideResults();

    try {
      // Execute flow
      await this.executor.execute(
        parsed,
        initialInput,
        (execution) => this.updateProgress(execution)
      );

      this.showSuccess('Flow completed successfully');
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Flow execution failed');
    }
  }

  private showProgress(_totalSteps: number): void {
    this.flowProgressContainer.classList.remove('hidden');
    this.progressFill.style.width = '0%';
    this.flowStepsStatus.innerHTML = '';
  }

  private hideProgress(): void {
    this.flowProgressContainer.classList.add('hidden');
  }

  private updateProgress(execution: FlowExecution): void {
    // Update progress bar
    const progress = ((execution.currentStepIndex + 1) / execution.steps.length) * 100;
    this.progressFill.style.width = `${progress}%`;

    // Update steps status
    this.flowStepsStatus.innerHTML = '';
    execution.steps.forEach((step, index) => {
      const stepEl = document.createElement('div');
      stepEl.className = `step-status ${step.status}`;

      const icon = document.createElement('div');
      icon.className = 'step-icon';
      icon.textContent = this.getStepIcon(step.status);

      const content = document.createElement('div');
      content.className = 'step-content';

      const title = document.createElement('div');
      title.className = 'step-title';
      title.textContent = `Step ${index + 1}: ${this.getStepStatusText(step.status)}`;

      const description = document.createElement('div');
      description.className = 'step-description';
      description.textContent = step.step.instruction;

      content.appendChild(title);
      content.appendChild(description);

      stepEl.appendChild(icon);
      stepEl.appendChild(content);

      this.flowStepsStatus.appendChild(stepEl);
    });

    // Show results if completed
    if (execution.status === 'completed') {
      this.showResults(execution);
    }
  }

  private showResults(execution: FlowExecution): void {
    this.flowResultsContainer.classList.remove('hidden');
    this.flowOutput.innerHTML = '';

    execution.steps.forEach((step, index) => {
      if (step.output) {
        const resultEl = document.createElement('div');
        resultEl.className = 'result-step';

        const title = document.createElement('div');
        title.className = 'result-step-title';
        title.innerHTML = `<span>📍</span> Step ${index + 1}: ${step.step.instruction}`;

        const content = document.createElement('div');
        content.className = 'result-step-content';
        content.innerHTML = renderMarkdown(step.output);

        resultEl.appendChild(title);
        resultEl.appendChild(content);

        this.flowOutput.appendChild(resultEl);
      }
    });
  }

  private hideResults(): void {
    this.flowResultsContainer.classList.add('hidden');
  }

  private getStepIcon(status: string): string {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'running':
        return '▶️';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  }

  private getStepStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'running':
        return 'Running...';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  }

  loadFlowsList(): void {
    const flows = flowStorage.getAllFlows();
    this.flowsList.innerHTML = '';

    if (flows.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.padding = '2rem 1rem';
      emptyState.style.textAlign = 'center';
      emptyState.style.color = 'var(--text-muted)';
      emptyState.innerHTML = `
        <p>No saved flows yet.</p>
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">Create your first flow or try an example.</p>
      `;
      this.flowsList.appendChild(emptyState);
      return;
    }

    flows.forEach((flow) => {
      const flowEl = document.createElement('div');
      flowEl.className = 'flow-item';

      const name = document.createElement('div');
      name.className = 'flow-item-name';
      name.textContent = flow.name;

      const desc = document.createElement('div');
      desc.className = 'flow-item-desc';
      desc.textContent = flow.description;

      const actions = document.createElement('div');
      actions.className = 'flow-item-actions';

      const loadBtn = document.createElement('button');
      loadBtn.className = 'btn-secondary';
      loadBtn.textContent = 'Load';
      loadBtn.addEventListener('click', () => this.loadFlow(flow));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteFlow(flow.id);
      });

      actions.appendChild(loadBtn);
      actions.appendChild(deleteBtn);

      flowEl.appendChild(name);
      flowEl.appendChild(desc);
      flowEl.appendChild(actions);

      this.flowsList.appendChild(flowEl);
    });
  }

  loadFlow(flow: SavedFlow): void {
    this.currentFlow = flow;
    this.flowNameInput.value = flow.name;
    this.flowDescriptionInput.value = flow.description;
    this.flowInputInput.value = flow.initialInput || '';
    this.hideProgress();
    this.hideResults();

    // Switch to flows tab
    const flowsTab = document.querySelector('[data-tab="flows"]') as HTMLButtonElement;
    if (flowsTab) {
      flowsTab.click();
    }
  }

  deleteFlow(id: string): void {
    if (confirm('Are you sure you want to delete this flow?')) {
      flowStorage.deleteFlow(id);
      this.loadFlowsList();

      if (this.currentFlow?.id === id) {
        this.handleNewFlow();
      }
    }
  }

  loadExampleFlow(): void {
    const example = EXAMPLE_FLOWS[0];
    this.flowNameInput.value = example.name;
    this.flowDescriptionInput.value = example.description;
    this.flowInputInput.value = example.initialInput || '';
    this.hideProgress();
    this.hideResults();

    // Switch to flows tab
    const flowsTab = document.querySelector('[data-tab="flows"]') as HTMLButtonElement;
    if (flowsTab) {
      flowsTab.click();
    }
  }

  private showError(message: string): void {
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = message;

    const container = document.querySelector('.flows-builder');
    if (container) {
      container.insertBefore(errorEl, container.firstChild);
      setTimeout(() => errorEl.remove(), 5000);
    }
  }

  private showSuccess(message: string): void {
    const successEl = document.createElement('div');
    successEl.className = 'success-message';
    successEl.textContent = message;

    const container = document.querySelector('.flows-builder');
    if (container) {
      container.insertBefore(successEl, container.firstChild);
      setTimeout(() => successEl.remove(), 3000);
    }
  }

  setLLMClient(client: LLMClient): void {
    this.llmClient = client;
    this.executor = new FlowExecutor(client);
  }
}
