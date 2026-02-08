export interface Prompt {
  id: string;
  tag: string;
  title: string;
  content: string;
  filePath: string;
  parameters: string[];
  partials: string[];
  partialPickers: { path: string; defaultPath?: string }[];
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

export interface Workspace {
  id: string;
  name: string;
  path: string;
  isGlobal: boolean;
  isGit?: boolean;
  autoSync?: boolean;
  lastUsed: number;
}

export interface GitStatus {
  isGit: boolean;
  branch?: string;
  hasRemote?: boolean;
  hasUncommittedChanges?: boolean;
  ahead?: number;
  behind?: number;
}
