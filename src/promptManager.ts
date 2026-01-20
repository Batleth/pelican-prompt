import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import lunr from 'lunr';
import { Prompt, SearchResult } from './types';

export class PromptManager {
  private promptsFolder: string;
  private prompts: Map<string, Prompt> = new Map();
  private searchIndex: lunr.Index | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private readonly MAX_TAG_DEPTH = 5;

  constructor(baseFolder: string) {
    this.promptsFolder = path.join(baseFolder, 'prompts');
    this.loadPrompts();
    this.initializeWatcher();
  }

  private initializeWatcher(): void {
    this.watcher = chokidar.watch(`${this.promptsFolder}/**/*.md`, {
      persistent: true,
      ignoreInitial: true,
      depth: this.MAX_TAG_DEPTH
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath))
      .on('change', (filePath) => this.handleFileChange(filePath))
      .on('unlink', (filePath) => this.handleFileRemove(filePath));
  }

  private handleFileChange(filePath: string): void {
    const prompt = this.parsePromptFile(filePath);
    if (prompt) {
      this.prompts.set(filePath, prompt);
      this.rebuildIndex();
    }
  }

  private handleFileRemove(filePath: string): void {
    this.prompts.delete(filePath);
    this.rebuildIndex();
    this.cleanupEmptyFolders(path.dirname(filePath));
  }

  private parsePromptFile(filePath: string): Prompt | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const filename = path.basename(filePath, '.md');
      const title = filename;
      
      // Extract tag from folder path hierarchy
      const relativePath = path.relative(this.promptsFolder, path.dirname(filePath));
      const pathSegments = relativePath === '.' ? [] : relativePath.split(path.sep);
      const tag = pathSegments.length > 0 ? pathSegments.join('-') : '';

      // Extract parameters from content (e.g., [PARAM])
      const paramRegex = /\[([A-Z_]+)\]/g;
      const parameters: string[] = [];
      let match;
      
      while ((match = paramRegex.exec(content)) !== null) {
        if (!parameters.includes(match[1])) {
          parameters.push(match[1]);
        }
      }

      return {
        id: filePath,
        tag,
        title,
        content,
        filePath,
        parameters
      };
    } catch (error) {
      console.error(`Error parsing prompt file ${filePath}:`, error);
      return null;
    }
  }

  private loadPrompts(): void {
    try {
      if (!fs.existsSync(this.promptsFolder)) {
        fs.mkdirSync(this.promptsFolder, { recursive: true });
      }

      this.prompts.clear();
      this.loadPromptsRecursive(this.promptsFolder, 0);
      this.rebuildIndex();
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
  }

  private loadPromptsRecursive(dir: string, depth: number): void {
    if (depth > this.MAX_TAG_DEPTH) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        this.loadPromptsRecursive(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const prompt = this.parsePromptFile(fullPath);
        if (prompt) {
          this.prompts.set(fullPath, prompt);
        }
      }
    }
  }

  private rebuildIndex(): void {
    try {
      const documents = Array.from(this.prompts.values()).map(prompt => ({
        id: prompt.id,
        title: prompt.title,
        tag: prompt.tag,
        content: prompt.content
      }));

      if (documents.length === 0) {
        this.searchIndex = null;
        return;
      }

      this.searchIndex = lunr(function() {
        this.ref('id');
        this.field('title', { boost: 10 });
        this.field('tag', { boost: 5 });
        this.field('content');

        documents.forEach(doc => {
          this.add(doc);
        });
      });
      
      console.log(`Index rebuilt with ${documents.length} prompts`);
    } catch (error) {
      console.error('Error rebuilding index:', error);
    }
  }

  public search(query: string): SearchResult[] {
    if (!this.searchIndex || query.trim() === '') {
      return Array.from(this.prompts.values()).map(prompt => ({
        prompt,
        score: 1
      }));
    }

    // Check for tag filter: tag:tagname or tag:prefix* or tag:*suffix or tag:*contains*
    const tagMatch = query.match(/tag:(\S+)/);
    let filteredPrompts = Array.from(this.prompts.values());
    let searchQuery = query;

    if (tagMatch) {
      const tagFilter = tagMatch[1].toLowerCase();
      
      if (tagFilter.startsWith('*') && tagFilter.endsWith('*')) {
        // Contains wildcard: tag:*python* matches code-python-async, python-utils, etc.
        const contains = tagFilter.slice(1, -1);
        filteredPrompts = filteredPrompts.filter(p => 
          p.tag.toLowerCase().includes(contains)
        );
      } else if (tagFilter.startsWith('*')) {
        // Suffix wildcard: tag:*python matches code-python, lang-python, etc.
        const suffix = tagFilter.slice(1);
        filteredPrompts = filteredPrompts.filter(p => 
          p.tag.toLowerCase().endsWith(suffix) || 
          p.tag.toLowerCase().includes('-' + suffix)
        );
      } else if (tagFilter.endsWith('*')) {
        // Prefix wildcard: tag:code* matches code, code-python, code-js, etc.
        const prefix = tagFilter.slice(0, -1);
        filteredPrompts = filteredPrompts.filter(p => 
          p.tag.toLowerCase().startsWith(prefix)
        );
      } else {
        // Exact match
        filteredPrompts = filteredPrompts.filter(p => 
          p.tag.toLowerCase() === tagFilter
        );
      }
      
      searchQuery = query.replace(/tag:\S+/g, '').trim();
    } else {
      // Remove incomplete "tag:" patterns (e.g., "tag:" or "tag: " without value)
      searchQuery = query.replace(/tag:\s*/g, '').trim();
    }

    // If only tag filter and no other search terms, return filtered results
    if (searchQuery === '') {
      return filteredPrompts.map(prompt => ({
        prompt,
        score: 1
      }));
    }

    try {
      const results = this.searchIndex.search(searchQuery);
      const filteredIds = new Set(filteredPrompts.map(p => p.id));
      
      return results
        .filter(result => filteredIds.has(result.ref))
        .map(result => ({
          prompt: this.prompts.get(result.ref)!,
          score: result.score
        }))
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  public getAllPrompts(): Prompt[] {
    return Array.from(this.prompts.values());
  }

  public reloadFromDisk(): void {
    this.loadPrompts();
    this.rebuildIndex();
  }

  public getPrompt(filePath: string): Prompt | null {
    return this.prompts.get(filePath) || null;
  }

  public async savePrompt(
    tag: string, 
    title: string, 
    content: string, 
    existingPath?: string
  ): Promise<string> {
    // Validate tag depth
    const tagSegments = tag ? tag.split('-') : [];
    if (tagSegments.length > this.MAX_TAG_DEPTH) {
      throw new Error(`Tag hierarchy cannot exceed ${this.MAX_TAG_DEPTH} levels`);
    }

    // Build folder path from tag segments
    const folderPath = tagSegments.length > 0 
      ? path.join(this.promptsFolder, ...tagSegments)
      : this.promptsFolder;
    
    const filename = `${title}.md`;
    const newPath = path.join(folderPath, filename);

    // Create folder structure if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // If editing an existing prompt with a different path, remove the old file
    if (existingPath && existingPath !== newPath && fs.existsSync(existingPath)) {
      fs.unlinkSync(existingPath);
      this.cleanupEmptyFolders(path.dirname(existingPath));
    }

    fs.writeFileSync(newPath, content, 'utf-8');
    return newPath;
  }

  private cleanupEmptyFolders(dir: string): void {
    // Don't delete the root prompts folder
    if (dir === this.promptsFolder || !dir.startsWith(this.promptsFolder)) {
      return;
    }

    try {
      const entries = fs.readdirSync(dir);
      
      // If directory is empty, delete it and check parent
      if (entries.length === 0) {
        fs.rmdirSync(dir);
        this.cleanupEmptyFolders(path.dirname(dir));
      }
    } catch (error) {
      // Ignore errors (directory might not exist or not be empty)
    }
  }

  public destroy(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
