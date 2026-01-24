import * as path from 'path';
import * as chokidar from 'chokidar';
import { Prompt, SearchResult, Partial } from './types';
import { TagService } from './services/tagService';
import { PromptService } from './services/promptService';
import { PartialService } from './services/partialService';
import { SearchService } from './services/searchService';

export class PromptManager {
  private promptsFolder: string;
  private partialsFolder: string;
  private watcher: chokidar.FSWatcher | null = null;
  private partialsWatcher: chokidar.FSWatcher | null = null;

  // Services
  private tagService: TagService;
  private promptService: PromptService;
  private partialService: PartialService;
  private searchService: SearchService;

  constructor(baseFolder: string) {
    this.promptsFolder = path.join(baseFolder, 'prompts');
    this.partialsFolder = path.join(baseFolder, 'partials');

    // Initialize services
    this.tagService = new TagService();
    this.promptService = new PromptService(this.promptsFolder, this.tagService);
    this.partialService = new PartialService(this.partialsFolder, this.tagService);
    this.searchService = new SearchService();

    // Load initial data
    this.promptService.loadPrompts();
    this.partialService.loadPartials();
    this.searchService.rebuildIndex(this.promptService.getAllPrompts());

    // Initialize file watchers
    this.initializeWatcher();
  }

  private initializeWatcher(): void {
    const MAX_TAG_DEPTH = this.tagService.getMaxDepth();

    // Watch prompts folder
    this.watcher = chokidar.watch(`${this.promptsFolder}/**/*.md`, {
      persistent: true,
      ignoreInitial: true,
      depth: MAX_TAG_DEPTH
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath))
      .on('change', (filePath) => this.handleFileChange(filePath))
      .on('unlink', (filePath) => this.handleFileRemove(filePath));

    // Watch partials folder
    this.partialsWatcher = chokidar.watch(`${this.partialsFolder}/**/*.md`, {
      persistent: true,
      ignoreInitial: true,
      depth: MAX_TAG_DEPTH
    });

    this.partialsWatcher
      .on('add', (filePath) => this.handlePartialChange(filePath))
      .on('change', (filePath) => this.handlePartialChange(filePath))
      .on('unlink', (filePath) => this.handlePartialRemove(filePath));
  }

  private handleFileChange(filePath: string): void {
    if (this.promptService.handleFileChange(filePath)) {
      this.searchService.rebuildIndex(this.promptService.getAllPrompts());
    }
  }

  private handleFileRemove(filePath: string): void {
    this.promptService.handleFileRemove(filePath);
    this.searchService.rebuildIndex(this.promptService.getAllPrompts());
  }

  private handlePartialChange(filePath: string): void {
    this.partialService.handlePartialChange(filePath);
  }

  private handlePartialRemove(filePath: string): void {
    this.partialService.handlePartialRemove(filePath);
  }

  // Public API - Prompts
  public getAllPrompts(): Prompt[] {
    return this.promptService.getAllPrompts();
  }

  public getPrompt(filePath: string): Prompt | null {
    return this.promptService.getPrompt(filePath);
  }

  public async deletePrompt(filePath: string): Promise<void> {
    await this.promptService.deletePrompt(filePath);
    this.searchService.rebuildIndex(this.promptService.getAllPrompts());
  }

  public async savePrompt(
    tag: string,
    title: string,
    content: string,
    existingPath?: string
  ): Promise<string> {
    return await this.promptService.savePrompt(tag, title, content, existingPath);
  }

  public reloadFromDisk(): void {
    this.promptService.loadPrompts();
    this.partialService.loadPartials();
    this.searchService.rebuildIndex(this.promptService.getAllPrompts());
  }

  // Public API - Search
  public search(query: string): SearchResult[] {
    return this.searchService.search(query, this.promptService.getAllPrompts());
  }

  // Public API - Partials
  public getAllPartials(): Partial[] {
    return this.partialService.getAllPartials();
  }

  public getPartial(dotPath: string): { content: string; filePath: string } | null {
    return this.partialService.getPartial(dotPath);
  }

  public searchPartials(query: string): Partial[] {
    return this.partialService.searchPartials(query);
  }

  public validatePartials(partialRefs: string[]): string[] {
    return this.partialService.validatePartials(partialRefs);
  }

  public validatePartialContent(content: string): { valid: boolean; error?: string } {
    return this.partialService.validatePartialContent(content);
  }

  public validatePartialPath(dotPath: string): { valid: boolean; error?: string } {
    return this.tagService.validatePathDepth(dotPath);
  }

  public async savePartial(
    dotPath: string,
    content: string,
    existingPath?: string
  ): Promise<string> {
    return await this.partialService.savePartial(dotPath, content, existingPath);
  }

  public resolvePartials(content: string): string {
    return this.partialService.resolvePartials(content);
  }

  public getPartialsInFolder(dotPath: string): Partial[] {
    return this.partialService.getPartialsInFolder(dotPath);
  }

  // Cleanup
  public destroy(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.partialsWatcher) {
      this.partialsWatcher.close();
      this.partialsWatcher = null;
    }
  }
}
