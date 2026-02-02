// Natural language flow parser

export interface FlowStep {
  order: number;
  instruction: string;
  usesPreviousOutput: boolean;
}

export interface ParsedFlow {
  steps: FlowStep[];
  rawDescription: string;
}

// Keywords that indicate sequential steps
const STEP_KEYWORDS = [
  'first',
  'then',
  'next',
  'after that',
  'finally',
  'lastly',
  'subsequently',
  'following that',
  'and then',
];

export function parseFlowDescription(description: string): ParsedFlow {
  if (!description || description.trim() === '') {
    return { steps: [], rawDescription: description };
  }

  const steps: FlowStep[] = [];

  // Normalize the description
  let normalized = description.trim();

  // Split by common delimiters
  const segments: string[] = [];

  // Try to split by step keywords
  let currentSegment = '';
  const words = normalized.split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    const nextWord = i < words.length - 1 ? words[i + 1].toLowerCase() : '';
    const twoWords = `${word} ${nextWord}`;

    // Check for two-word keywords
    if (STEP_KEYWORDS.includes(twoWords)) {
      if (currentSegment.trim()) {
        segments.push(currentSegment.trim());
      }
      currentSegment = '';
      i++; // Skip next word
    } else if (STEP_KEYWORDS.includes(word)) {
      if (currentSegment.trim()) {
        segments.push(currentSegment.trim());
      }
      currentSegment = '';
    } else {
      currentSegment += words[i] + ' ';
    }
  }

  // Add the last segment
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  // If no keywords found, try splitting by periods, commas, or semicolons
  if (segments.length <= 1) {
    segments.length = 0;
    const splitByPunctuation = normalized.split(/[,;.]/).filter(s => s.trim());
    segments.push(...splitByPunctuation);
  }

  // If still only one segment, treat the whole thing as a single step
  if (segments.length === 0) {
    segments.push(normalized);
  }

  // Create steps from segments
  segments.forEach((segment, index) => {
    const instruction = segment.trim();
    if (instruction) {
      steps.push({
        order: index + 1,
        instruction,
        usesPreviousOutput: index > 0, // All steps after the first use previous output
      });
    }
  });

  return {
    steps,
    rawDescription: description,
  };
}

export function validateFlow(flow: ParsedFlow): { valid: boolean; error?: string } {
  if (!flow.steps || flow.steps.length === 0) {
    return {
      valid: false,
      error: 'Flow must contain at least one step',
    };
  }

  for (const step of flow.steps) {
    if (!step.instruction || step.instruction.trim() === '') {
      return {
        valid: false,
        error: `Step ${step.order} has no instruction`,
      };
    }
  }

  return { valid: true };
}

export function formatStepPrompt(step: FlowStep, previousOutput?: string): string {
  let prompt = step.instruction;

  // If this step should use previous output and we have it
  if (step.usesPreviousOutput && previousOutput) {
    // Check if the instruction already references the previous output
    const referencesOutput = /\b(this|that|it|the (result|output|response|text|content))\b/i.test(prompt);

    if (referencesOutput) {
      // If it references output implicitly, prepend the previous output
      prompt = `Given this content:\n\n${previousOutput}\n\n${prompt}`;
    } else {
      // If it doesn't reference output, append it
      prompt = `${prompt}\n\nContent to work with:\n${previousOutput}`;
    }
  }

  return prompt;
}
