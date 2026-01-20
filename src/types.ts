export interface Prompt {
  id: string;
  tag: string;
  title: string;
  content: string;
  filePath: string;
  parameters: string[];
  partials: string[];
}

export interface SearchResult {
  prompt: Prompt;
  score: number;
}

export interface Partial {
  path: string;
  content: string;
  filePath: string;
}
