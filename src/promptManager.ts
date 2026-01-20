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

  constructor(promptsFolder: string) {
    this.promptsFolder = promptsFolder;
    this.loadPrompts();
    this.initializeWatcher();
  }

  private initializeWatcher(): void {
    this.watcher = chokidar.watch(`${this.promptsFolder}/*.md`, {
      persistent: true,
      ignoreInitial: true
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
  }

  private parsePromptFile(filePath: string): Prompt | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const filename = path.basename(filePath, '.md');
      
      // Parse tag and title from filename: [tag]_[title].md
      const parts = filename.split('_');
      let tag = '';
      let title = filename;
      
      if (parts.length >= 2) {
        tag = parts[0];
        title = parts.slice(1).join('_');
      }

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

      this.prompts.clear(); // Clear existing prompts
      const files = fs.readdirSync(this.promptsFolder);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(this.promptsFolder, file);
          const prompt = this.parsePromptFile(filePath);
          if (prompt) {
            this.prompts.set(filePath, prompt);
          }
        }
      }

      this.rebuildIndex();
    } catch (error) {
      console.error('Error loading prompts:', error);
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

    // Check for tag filter: tag:tagname
    const tagMatch = query.match(/tag:(\S+)/);
    let filteredPrompts = Array.from(this.prompts.values());
    let searchQuery = query;

    if (tagMatch) {
      const tagFilter = tagMatch[1].toLowerCase();
      filteredPrompts = filteredPrompts.filter(p => 
        p.tag.toLowerCase() === tagFilter
      );
      searchQuery = query.replace(/tag:\S+/g, '').trim();
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
    const filename = `${tag}_${title}.md`;
    const newPath = path.join(this.promptsFolder, filename);

    // If editing an existing prompt with a different name, remove the old file
    if (existingPath && existingPath !== newPath && fs.existsSync(existingPath)) {
      fs.unlinkSync(existingPath);
    }

    fs.writeFileSync(newPath, content, 'utf-8');
    return newPath;
  }

  public destroy(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
