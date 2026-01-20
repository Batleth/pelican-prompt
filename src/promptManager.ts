import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import lunr from 'lunr';
import { Prompt, SearchResult, Partial } from './types';

export class PromptManager {
  private promptsFolder: string;
  private partialsFolder: string;
  private prompts: Map<string, Prompt> = new Map();
  private partials: Map<string, { content: string; filePath: string }> = new Map();
  private searchIndex: lunr.Index | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private partialsWatcher: chokidar.FSWatcher | null = null;
  private readonly MAX_TAG_DEPTH = 5;

  constructor(baseFolder: string) {
    this.promptsFolder = path.join(baseFolder, 'prompts');
    this.partialsFolder = path.join(baseFolder, 'partials');
    this.loadPrompts();
    this.loadPartials();
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

    // Watch partials folder
    this.partialsWatcher = chokidar.watch(`${this.partialsFolder}/**/*.md`, {
      persistent: true,
      ignoreInitial: true,
      depth: this.MAX_TAG_DEPTH
    });

    this.partialsWatcher
      .on('add', (filePath) => this.handlePartialChange(filePath))
      .on('change', (filePath) => this.handlePartialChange(filePath))
      .on('unlink', (filePath) => this.handlePartialRemove(filePath));
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

      // Extract partials from content (e.g., {{> path.to.partial}})
      const partialRegex = /\{\{>\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
      const partials: string[] = [];
      
      while ((match = partialRegex.exec(content)) !== null) {
        if (!partials.includes(match[1])) {
          partials.push(match[1]);
        }
      }

      return {
        id: filePath,
        tag,
        title,
        content,
        filePath,
        parameters,
        partials
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

  private loadPartials(): void {
    try {
      if (!fs.existsSync(this.partialsFolder)) {
        fs.mkdirSync(this.partialsFolder, { recursive: true });
      }

      this.partials.clear();
      this.loadPartialsRecursive(this.partialsFolder, 0);
    } catch (error) {
      console.error('Error loading partials:', error);
    }
  }

  private loadPartialsRecursive(dir: string, depth: number): void {
    if (depth > this.MAX_TAG_DEPTH) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        this.loadPartialsRecursive(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8').trim();
          
          // Skip empty partials
          if (!content) {
            console.warn(`Skipping empty partial: ${fullPath}`);
            continue;
          }
          
          // Validate partials don't contain other partials
          if (/\{\{>\s*([a-zA-Z0-9_.-]+)\s*\}\}/g.test(content)) {
            console.error(`Partial cannot contain other partials: ${fullPath}`);
            continue;
          }
          
          // Convert file path to dot notation
          const relativePath = path.relative(this.partialsFolder, fullPath);
          const pathWithoutExt = relativePath.replace(/\.md$/, '');
          const dotPath = pathWithoutExt.split(path.sep).join('.');
          
          this.partials.set(dotPath, { path: dotPath, content, filePath: fullPath });
        } catch (error) {
          console.error(`Error loading partial ${fullPath}:`, error);
        }
      }
    }
  }

  private handlePartialChange(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      
      if (!content || /\{\{>\s*([a-zA-Z0-9_.-]+)\s*\}\}/g.test(content)) {
        // Remove invalid partial
        const relativePath = path.relative(this.partialsFolder, filePath);
        const pathWithoutExt = relativePath.replace(/\.md$/, '');
        const dotPath = pathWithoutExt.split(path.sep).join('.');
        this.partials.delete(dotPath);
        return;
      }
      
      const relativePath = path.relative(this.partialsFolder, filePath);
      const pathWithoutExt = relativePath.replace(/\.md$/, '');
      const dotPath = pathWithoutExt.split(path.sep).join('.');
      
      this.partials.set(dotPath, { path: dotPath, content, filePath });
    } catch (error) {
      console.error(`Error handling partial change ${filePath}:`, error);
    }
  }

  private handlePartialRemove(filePath: string): void {
    const relativePath = path.relative(this.partialsFolder, filePath);
    const pathWithoutExt = relativePath.replace(/\.md$/, '');
    const dotPath = pathWithoutExt.split(path.sep).join('.');
    this.partials.delete(dotPath);
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
        // Exact or prefix match: tag:com matches com, com-mail, com-meeting, etc.
        filteredPrompts = filteredPrompts.filter(p => 
          p.tag.toLowerCase() === tagFilter || 
          p.tag.toLowerCase().startsWith(tagFilter + '-')
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

  public async deletePrompt(filePath: string): Promise<void> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('Prompt file not found');
      }

      // Delete the file
      try {
        fs.unlinkSync(filePath);
      } catch (err: any) {
        throw new Error(`Failed to delete file: ${err.message}`);
      }

      // Remove from prompts map
      this.prompts.delete(filePath);

      // Rebuild search index
      this.rebuildIndex();

      // Clean up empty folders
      this.cleanupEmptyFolders(path.dirname(filePath));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete prompt');
    }
  }

  public async savePartial(
    dotPath: string,
    content: string,
    existingPath?: string
  ): Promise<string> {
    try {
      // Validate partial path
      const validation = this.validatePartialPath(dotPath);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid partial path');
      }

      // Validate partial content
      const contentValidation = this.validatePartialContent(content);
      if (!contentValidation.valid) {
        throw new Error(contentValidation.error || 'Invalid partial content');
      }

      // Convert dot path to file path
      const pathSegments = dotPath.split('.');
      const folderPath = pathSegments.length > 1
        ? path.join(this.partialsFolder, ...pathSegments.slice(0, -1))
        : this.partialsFolder;
      
      const filename = `${pathSegments[pathSegments.length - 1]}.md`;
      const newPath = path.join(folderPath, filename);
      const normalizedNewPath = path.normalize(newPath);
      const normalizedExistingPath = existingPath ? path.normalize(existingPath) : undefined;
      const isSameFile = normalizedNewPath === normalizedExistingPath;

      // Check if file already exists (not overwriting same file)
      if (!isSameFile && fs.existsSync(normalizedNewPath)) {
        const relativePath = path.relative(this.partialsFolder, normalizedNewPath);
        if (existingPath) {
          const existingRelative = path.relative(this.partialsFolder, existingPath);
          throw new Error(`Cannot rename to "${relativePath}" - a different partial already exists there. You are editing "${existingRelative}".`);
        } else {
          throw new Error(`A partial already exists at "${relativePath}". Please use a different path.`);
        }
      }

      // Create folder structure if it doesn't exist
      try {
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
      } catch (err: any) {
        throw new Error(`Failed to create folder structure: ${err.message}`);
      }

      // Write the file first
      try {
        fs.writeFileSync(normalizedNewPath, content, 'utf-8');
      } catch (err: any) {
        throw new Error(`Failed to write file: ${err.message}`);
      }

      // Only after successful write, remove the old file if path changed
      if (existingPath && !isSameFile && fs.existsSync(existingPath)) {
        try {
          fs.unlinkSync(existingPath);
          this.partials.delete(dotPath);
          this.cleanupEmptyFolders(path.dirname(existingPath));
        } catch (err: any) {
          console.warn(`Could not remove old partial file: ${err.message}`);
        }
      }

      // Update partials map
      this.partials.set(dotPath, { content, filePath: normalizedNewPath });

      return normalizedNewPath;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to save partial');
    }
  }

  public async savePrompt(
    tag: string, 
    title: string, 
    content: string, 
    existingPath?: string
  ): Promise<string> {
    try {
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

      // Normalize paths for comparison
      const normalizedNewPath = path.normalize(newPath);
      const normalizedExistingPath = existingPath ? path.normalize(existingPath) : undefined;
      const isSameFile = normalizedNewPath === normalizedExistingPath;

      // Check if file already exists (not overwriting same file)
      if (!isSameFile && fs.existsSync(normalizedNewPath)) {
        const relativePath = path.relative(this.promptsFolder, normalizedNewPath);
        if (existingPath) {
          const existingRelative = path.relative(this.promptsFolder, existingPath);
          throw new Error(`Cannot rename to "${relativePath}" - a different prompt already exists there. You are editing "${existingRelative}".`);
        } else {
          throw new Error(`A prompt already exists at "${relativePath}". Please use a different tag or title.`);
        }
      }

      // Create folder structure if it doesn't exist
      try {
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
      } catch (err: any) {
        throw new Error(`Failed to create folder structure: ${err.message}`);
      }

      // Write the file first (before deleting the old one to avoid data loss)
      try {
        fs.writeFileSync(normalizedNewPath, content, 'utf-8');
      } catch (err: any) {
        throw new Error(`Failed to write file: ${err.message}`);
      }

      // Only after successful write, remove the old file if path changed
      if (existingPath && !isSameFile && fs.existsSync(existingPath)) {
        try {
          fs.unlinkSync(existingPath);
          this.cleanupEmptyFolders(path.dirname(existingPath));
        } catch (err: any) {
          // Log warning but don't fail - new file is already written
          console.warn(`Could not remove old file: ${err.message}`);
        }
      }

      return normalizedNewPath;
    } catch (error: any) {
      // Rethrow with clear message
      throw new Error(error.message || 'Failed to save prompt');
    }
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

  // Partials API methods
  public getAllPartials(): Partial[] {
    const partials: Partial[] = [];
    for (const [dotPath, data] of this.partials.entries()) {
      partials.push({
        path: dotPath,
        content: data.content,
        filePath: data.filePath
      });
    }
    return partials.sort((a, b) => a.path.localeCompare(b.path));
  }

  public getPartial(dotPath: string): { content: string; filePath: string } | null {
    return this.partials.get(dotPath) || null;
  }

  public searchPartials(query: string): Partial[] {
    const lowerQuery = query.toLowerCase();
    const partials: Partial[] = [];
    
    for (const [dotPath, data] of this.partials.entries()) {
      if (dotPath.toLowerCase().includes(lowerQuery) || 
          data.content.toLowerCase().includes(lowerQuery)) {
        partials.push({
          path: dotPath,
          content: data.content,
          filePath: data.filePath
        });
      }
    }
    
    return partials.sort((a, b) => a.path.localeCompare(b.path));
  }

  public validatePartials(partialRefs: string[]): string[] {
    const missing: string[] = [];
    for (const ref of partialRefs) {
      if (!this.partials.has(ref)) {
        missing.push(ref);
      }
    }
    return missing;
  }

  public validatePartialContent(content: string): { valid: boolean; error?: string } {
    const trimmed = content.trim();
    
    if (!trimmed) {
      return { valid: false, error: 'Partial content cannot be empty' };
    }
    
    if (/\{\{>\s*([a-zA-Z0-9_.]+)\s*\}\}/g.test(trimmed)) {
      return { valid: false, error: 'Partials cannot contain other partials ({{> }} syntax not allowed)' };
    }
    
    return { valid: true };
  }

  public validatePartialPath(dotPath: string): { valid: boolean; error?: string } {
    const segments = dotPath.split('.');
    
    if (segments.length === 0 || segments.some(s => !s)) {
      return { valid: false, error: 'Path cannot have empty segments' };
    }
    
    if (segments.length > this.MAX_TAG_DEPTH) {
      return { valid: false, error: `Path cannot exceed ${this.MAX_TAG_DEPTH} levels deep` };
    }
    
    for (const segment of segments) {
      if (!/^[a-zA-Z0-9_-]+$/.test(segment)) {
        return { valid: false, error: 'Path segments can only contain letters, numbers, hyphens, and underscores' };
      }
    }
    
    return { valid: true };
  }

  public resolvePartials(content: string): string {
    const partialRegex = /\{\{>\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
    
    return content.replace(partialRegex, (match, dotPath) => {
      const partial = this.partials.get(dotPath);
      if (partial) {
        return partial.content;
      } else {
        return `MISSING PARTIAL ${dotPath}`;
      }
    });
  }

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
