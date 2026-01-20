import * as fs from 'fs';
import * as path from 'path';

export class TagService {
  private readonly MAX_TAG_DEPTH = 5;

  /**
   * Extract tag from folder path hierarchy
   * @param promptsFolder - Base prompts folder
   * @param filePath - Full path to the prompt file
   * @returns Tag string (e.g., 'com-mail-formal')
   */
  public extractTagFromPath(promptsFolder: string, filePath: string): string {
    const relativePath = path.relative(promptsFolder, path.dirname(filePath));
    const pathSegments = relativePath === '.' ? [] : relativePath.split(path.sep);
    return pathSegments.length > 0 ? pathSegments.join('-') : '';
  }

  /**
   * Build folder path from tag segments
   * @param baseFolder - Base folder (prompts or partials)
   * @param tag - Tag string (e.g., 'com-mail-formal')
   * @returns Full folder path
   */
  public buildFolderPath(baseFolder: string, tag: string): string {
    const tagSegments = tag ? tag.split('-') : [];
    return tagSegments.length > 0 
      ? path.join(baseFolder, ...tagSegments)
      : baseFolder;
  }

  /**
   * Validate tag depth
   * @param tag - Tag string to validate
   * @returns Validation result
   */
  public validateTagDepth(tag: string): { valid: boolean; error?: string } {
    const tagSegments = tag ? tag.split('-') : [];
    if (tagSegments.length > this.MAX_TAG_DEPTH) {
      return { 
        valid: false, 
        error: `Tag hierarchy cannot exceed ${this.MAX_TAG_DEPTH} levels` 
      };
    }
    return { valid: true };
  }

  /**
   * Validate path depth (for dot-notation paths like partials)
   * @param dotPath - Dot-separated path (e.g., 'greetings.formal.business')
   * @returns Validation result
   */
  public validatePathDepth(dotPath: string): { valid: boolean; error?: string } {
    const segments = dotPath.split('.');
    
    if (segments.length === 0 || segments.some(s => !s)) {
      return { valid: false, error: 'Path cannot have empty segments' };
    }
    
    if (segments.length > this.MAX_TAG_DEPTH) {
      return { valid: false, error: `Path cannot exceed ${this.MAX_TAG_DEPTH} levels deep` };
    }
    
    for (const segment of segments) {
      if (!/^[a-zA-Z0-9_-]+$/.test(segment)) {
        return { 
          valid: false, 
          error: 'Path segments can only contain letters, numbers, hyphens, and underscores' 
        };
      }
    }
    
    return { valid: true };
  }

  /**
   * Recursively delete empty folders up to the base folder
   * @param dir - Directory to check and potentially delete
   * @param baseFolder - Root folder (won't be deleted)
   */
  public cleanupEmptyFolders(dir: string, baseFolder: string): void {
    // Don't delete the root folder
    if (dir === baseFolder || !dir.startsWith(baseFolder)) {
      return;
    }

    try {
      const entries = fs.readdirSync(dir);
      
      // If directory is empty, delete it and check parent
      if (entries.length === 0) {
        fs.rmdirSync(dir);
        this.cleanupEmptyFolders(path.dirname(dir), baseFolder);
      }
    } catch (error) {
      // Ignore errors (directory might not exist or not be empty)
    }
  }

  /**
   * Ensure folder structure exists
   * @param folderPath - Path to create
   */
  public ensureFolderExists(folderPath: string): void {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  }

  public getMaxDepth(): number {
    return this.MAX_TAG_DEPTH;
  }
}
