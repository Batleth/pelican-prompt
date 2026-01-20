export interface Prompt {
  id: string;
  tag: string;
  title: string;
  content: string;
  filePath: string;
  parameters: string[];
}

export interface SearchResult {
  prompt: Prompt;
  score: number;
}

export interface ParameterValue {
  name: string;
  value: string;
}
