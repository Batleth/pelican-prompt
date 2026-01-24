import * as fs from 'fs';
import * as path from 'path';
import { Prompt } from '../types';
import { TagService } from './tagService';

export class PromptService {
  private prompts: Map<string, Prompt> = new Map();
  private promptsFolder: string;
  private tagService: TagService;

  constructor(promptsFolder: string, tagService: TagService) {
    this.promptsFolder = promptsFolder;
    this.tagService = tagService;
  }

  /**
   * Parse a prompt file and extract metadata
   */
  public parsePromptFile(filePath: string): Prompt | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const filename = path.basename(filePath, '.md');
      const title = filename;

      // Extract tag from folder path hierarchy
      const tag = this.tagService.extractTagFromPath(this.promptsFolder, filePath);

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
      // We now need to distinguish between static partials ({{> path.to.partial}}) and dynamic pickers ({{> path.to.folder.*}})
      // Regex explanation:
      // {{>         : Start of partial tag
      // \s*         : Optional whitespace
      // ([^}]+)     : The content (path), capturing everything until closing brackets
      // \s*         : Optional whitespace
      // }}          : Closing tag
      const partialTagRegex = /\{\{>\s*([^}]+)\s*\}\}/g;
      const partials: string[] = [];
      const partialPickers: { path: string; defaultPath?: string }[] = [];

      while ((match = partialTagRegex.exec(content)) !== null) {
        const tagContent = match[1].trim();

        // Check if it's a dynamic picker (contains *)
        if (tagContent.includes('*')) {
          // Parse: "path.to.folder.* optional.default.path"
          // Split by whitespace
          const parts = tagContent.split(/\s+/);
          const pickerPath = parts[0].replace('.*', ''); // Remove .* from the end
          const defaultPath = parts.length > 1 ? parts[1] : undefined;

          if (!partialPickers.some(p => p.path === pickerPath)) {
            partialPickers.push({ path: pickerPath, defaultPath });
          }
        } else {
          // Static partial
          if (!partials.includes(tagContent)) {
            partials.push(tagContent);
          }
        }
      }

      return {
        id: filePath,
        tag,
        title,
        content,
        filePath,
        parameters,
        partials,
        partialPickers
      };
    } catch (error) {
      console.error(`Error parsing prompt file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Load all prompts from disk
   */
  public loadPrompts(): void {
    try {
      this.tagService.ensureFolderExists(this.promptsFolder);
      this.prompts.clear();
      this.loadPromptsRecursive(this.promptsFolder, 0);
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
  }

  private loadPromptsRecursive(dir: string, depth: number): void {
    if (depth > this.tagService.getMaxDepth()) {
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

  /**
   * Handle file change (add or update)
   */
  public handleFileChange(filePath: string): boolean {
    const prompt = this.parsePromptFile(filePath);
    if (prompt) {
      this.prompts.set(filePath, prompt);
      return true;
    }
    return false;
  }

  /**
   * Handle file removal
   */
  public handleFileRemove(filePath: string): void {
    this.prompts.delete(filePath);
    this.tagService.cleanupEmptyFolders(path.dirname(filePath), this.promptsFolder);
  }

  /**
   * Get all prompts
   */
  public getAllPrompts(): Prompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Get a specific prompt by file path
   */
  public getPrompt(filePath: string): Prompt | null {
    return this.prompts.get(filePath) || null;
  }

  /**
   * Delete a prompt
   */
  public async deletePrompt(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('Prompt file not found');
      }

      try {
        fs.unlinkSync(filePath);
      } catch (err: any) {
        throw new Error(`Failed to delete file: ${err.message}`);
      }

      this.prompts.delete(filePath);
      this.tagService.cleanupEmptyFolders(path.dirname(filePath), this.promptsFolder);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete prompt');
    }
  }

  /**
   * Save a prompt (create or update)
   */
  public async savePrompt(
    tag: string,
    title: string,
    content: string,
    existingPath?: string
  ): Promise<string> {
    try {
      // Validate tag depth
      const validation = this.tagService.validateTagDepth(tag);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid tag');
      }

      // Build folder path from tag segments
      const folderPath = this.tagService.buildFolderPath(this.promptsFolder, tag);
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
        this.tagService.ensureFolderExists(folderPath);
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
          this.tagService.cleanupEmptyFolders(path.dirname(existingPath), this.promptsFolder);
        } catch (err: any) {
          console.warn(`Could not remove old file: ${err.message}`);
        }
      }

      return normalizedNewPath;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to save prompt');
    }
  }

  /**
   * Clear all prompts from memory
   */
  public clear(): void {
    this.prompts.clear();
  }
}
