import * as fs from 'fs';
import * as path from 'path';
import { Partial } from '../types';
import { TagService } from './tagService';

export class PartialService {
  private partials: Map<string, { content: string; filePath: string }> = new Map();
  private partialsFolder: string;
  private tagService: TagService;

  constructor(partialsFolder: string, tagService: TagService) {
    this.partialsFolder = partialsFolder;
    this.tagService = tagService;
  }

  /**
   * Load all partials from disk
   */
  public loadPartials(): void {
    try {
      this.tagService.ensureFolderExists(this.partialsFolder);
      this.partials.clear();
      this.loadPartialsRecursive(this.partialsFolder, 0);
    } catch (error) {
      console.error('Error loading partials:', error);
    }
  }

  private loadPartialsRecursive(dir: string, depth: number): void {
    if (depth > this.tagService.getMaxDepth()) {
      return;
    }


    if (!fs.existsSync(dir)) return;

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
          if (/\{>\s*([a-zA-Z0-9_.-]+)\s*\}/g.test(content)) {
            console.error(`Partial cannot contain other partials: ${fullPath}`);
            continue;
          }

          // Convert file path to dot notation
          const dotPath = this.filePathToDotPath(fullPath);

          this.partials.set(dotPath, { content, filePath: fullPath });
        } catch (error) {
          console.error(`Error loading partial ${fullPath}:`, error);
        }
      }
    }
  }

  /**
   * Convert file path to dot notation
   */
  private filePathToDotPath(filePath: string): string {
    const relativePath = path.relative(this.partialsFolder, filePath);
    const pathWithoutExt = relativePath.replace(/\.md$/, '');
    // Ensure we use dots instead of system separator
    return pathWithoutExt.split(path.sep).join('.');
  }

  /**
   * Convert dot notation to file path
   */
  private dotPathToFilePath(dotPath: string): string {
    const pathSegments = dotPath.split('.');
    return path.join(this.partialsFolder, ...pathSegments) + '.md';
  }

  /**
   * Handle partial file change
   */
  public handlePartialChange(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8').trim();

      if (!content || /\{>\s*([a-zA-Z0-9_.-]+)\s*\}/g.test(content)) {
        // Remove invalid partial
        const dotPath = this.filePathToDotPath(filePath);
        this.partials.delete(dotPath);
        return;
      }

      const dotPath = this.filePathToDotPath(filePath);
      this.partials.set(dotPath, { content, filePath });
    } catch (error) {
      console.error(`Error handling partial change ${filePath}:`, error);
    }
  }

  /**
   * Handle partial file removal
   */
  public handlePartialRemove(filePath: string): void {
    const dotPath = this.filePathToDotPath(filePath);
    this.partials.delete(dotPath);
    this.tagService.cleanupEmptyFolders(path.dirname(filePath), this.partialsFolder);
  }

  /**
   * Get all partials
   */
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

  /**
   * Get a specific partial
   */
  public getPartial(dotPath: string): { content: string; filePath: string } | null {
    return this.partials.get(dotPath) || null;
  }

  /**
   * Search partials by query
   */
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

  /**
   * Validate that partial references exist
   */
  public validatePartials(partialRefs: string[]): string[] {
    const missing: string[] = [];
    for (const ref of partialRefs) {
      if (!this.partials.has(ref)) {
        missing.push(ref);
      }
    }
    return missing;
  }

  /**
   * Validate partial content
   */
  public validatePartialContent(content: string): { valid: boolean; error?: string } {
    const trimmed = content.trim();

    if (!trimmed) {
      return { valid: false, error: 'Partial content cannot be empty' };
    }

    if (/\{>\s*([a-zA-Z0-9_.]+)\s*\}/g.test(trimmed)) {
      return { valid: false, error: 'Partials cannot contain other partials ({> } syntax not allowed)' };
    }

    return { valid: true };
  }

  /**
   * Save a partial (create or update)
   */
  public async savePartial(
    dotPath: string,
    content: string,
    existingPath?: string
  ): Promise<string> {
    try {
      // Validate partial path
      const validation = this.tagService.validatePathDepth(dotPath);
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
        this.tagService.ensureFolderExists(folderPath);
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
          this.tagService.cleanupEmptyFolders(path.dirname(existingPath), this.partialsFolder);
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

  /**
   * Resolve all partial references in content
   */
  public resolvePartials(content: string): string {
    const partialRegex = /\{>\s*([a-zA-Z0-9_.-]+)\s*\}/g;

    return content.replace(partialRegex, (match, dotPath) => {
      const partial = this.partials.get(dotPath);
      if (partial) {
        return partial.content;
      } else {
        return `MISSING PARTIAL ${dotPath}`;
      }
    });
  }

  /**
   * Get all partials in a specific folder (direct children)
   */
  public getPartialsInFolder(dotPath: string): Partial[] {


    const partials: Partial[] = [];
    const prefix = dotPath + '.';

    for (const [path, data] of this.partials.entries()) {
      if (path.startsWith(prefix)) {
        // Check if it's a direct child
        const remaining = path.substring(prefix.length);
        if (!remaining.includes('.')) {
          partials.push({
            path: path,
            content: data.content,
            filePath: data.filePath
          });
        }
      }
    }


    return partials.sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Clear all partials from memory
   */
  public clear(): void {
    this.partials.clear();
  }
}
