import type { LLMClient, StreamCallback } from '../llm/types';
import type { FlowStep, ParsedFlow } from './parser';
import { formatStepPrompt } from './parser';

export type StepStatus = 'pending' | 'running' | 'completed' | 'error';

export interface StepExecution {
  step: FlowStep;
  status: StepStatus;
  output?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface FlowExecution {
  steps: StepExecution[];
  status: 'running' | 'completed' | 'error';
  currentStepIndex: number;
  startTime: number;
  endTime?: number;
}

export type ProgressCallback = (execution: FlowExecution) => void;

export class FlowExecutor {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  async execute(
    flow: ParsedFlow,
    initialInput: string,
    onProgress?: ProgressCallback,
    onStepStream?: StreamCallback
  ): Promise<FlowExecution> {
    const execution: FlowExecution = {
      steps: flow.steps.map(step => ({
        step,
        status: 'pending' as StepStatus,
      })),
      status: 'running',
      currentStepIndex: 0,
      startTime: Date.now(),
    };

    // Notify initial progress
    if (onProgress) {
      onProgress({ ...execution });
    }

    let previousOutput = initialInput;

    for (let i = 0; i < flow.steps.length; i++) {
      const stepExecution = execution.steps[i];
      stepExecution.status = 'running';
      stepExecution.startTime = Date.now();
      execution.currentStepIndex = i;

      // Notify progress
      if (onProgress) {
        onProgress({ ...execution });
      }

      try {
        // Format the prompt with previous output if needed
        const prompt = formatStepPrompt(stepExecution.step, previousOutput);

        // Execute the step
        const response = await this.llmClient.chat(
          {
            messages: [{ role: 'user', content: prompt }],
            stream: !!onStepStream,
          },
          onStepStream
        );

        stepExecution.output = response.content;
        stepExecution.status = 'completed';
        stepExecution.endTime = Date.now();

        // Update previous output for next step
        previousOutput = response.content;

        // Notify progress
        if (onProgress) {
          onProgress({ ...execution });
        }
      } catch (error) {
        stepExecution.status = 'error';
        stepExecution.error = error instanceof Error ? error.message : 'Unknown error';
        stepExecution.endTime = Date.now();
        execution.status = 'error';
        execution.endTime = Date.now();

        // Notify final progress
        if (onProgress) {
          onProgress({ ...execution });
        }

        throw error;
      }
    }

    execution.status = 'completed';
    execution.endTime = Date.now();

    // Notify final progress
    if (onProgress) {
      onProgress({ ...execution });
    }

    return execution;
  }

  updateClient(llmClient: LLMClient): void {
    this.llmClient = llmClient;
  }
}
