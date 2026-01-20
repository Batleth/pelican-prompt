#!/usr/bin/env ts-node
/**
 * Migration script to convert flat tag_Title.md files to folder-based structure
 * 
 * Usage: ts-node migrate.ts <path-to-prompts-folder>
 * 
 * This script:
 * 1. Reads all .md files from the root folder
 * 2. Extracts tag and title from filename (tag_Title.md pattern)
 * 3. Creates prompts/ subfolder and tag-based folder structure
 * 4. Moves files to prompts/tag/Title.md
 * 5. Cleans up empty folders
 */

import * as fs from 'fs';
import * as path from 'path';

interface MigrationResult {
  success: number;
  skipped: number;
  errors: { file: string; error: string }[];
}

function migratePromptsFolder(baseFolder: string): MigrationResult {
  const result: MigrationResult = {
    success: 0,
    skipped: 0,
    errors: []
  };

  console.log(`\nMigrating prompts in: ${baseFolder}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(baseFolder)) {
    console.error(`Error: Folder does not exist: ${baseFolder}`);
    process.exit(1);
  }

  // Create prompts subfolder
  const promptsFolder = path.join(baseFolder, 'prompts');
  if (!fs.existsSync(promptsFolder)) {
    fs.mkdirSync(promptsFolder, { recursive: true });
    console.log(`✓ Created prompts/ subfolder`);
  }

  // Get all .md files in the root folder (not in subdirectories)
  const files = fs.readdirSync(baseFolder);
  const mdFiles = files.filter(f => {
    const fullPath = path.join(baseFolder, f);
    return f.endsWith('.md') && fs.statSync(fullPath).isFile();
  });

  if (mdFiles.length === 0) {
    console.log('\nNo .md files found in root folder to migrate.');
    return result;
  }

  console.log(`\nFound ${mdFiles.length} .md file(s) to migrate:`);

  for (const file of mdFiles) {
    const oldPath = path.join(baseFolder, file);
    
    try {
      // Parse filename: tag_Title.md
      const filename = path.basename(file, '.md');
      const parts = filename.split('_');

      if (parts.length < 2) {
        // No underscore, skip migration (or treat as no-tag file)
        console.log(`  ⊘ Skipped: ${file} (no tag format detected)`);
        result.skipped++;
        continue;
      }

      const tag = parts[0];
      const title = parts.slice(1).join('_');

      // Validate tag (basic check)
      if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
        console.log(`  ⊘ Skipped: ${file} (invalid tag format)`);
        result.skipped++;
        continue;
      }

      // Build new path: prompts/tag/Title.md
      const tagFolder = path.join(promptsFolder, tag);
      const newPath = path.join(tagFolder, `${title}.md`);

      // Create tag folder if it doesn't exist
      if (!fs.existsSync(tagFolder)) {
        fs.mkdirSync(tagFolder, { recursive: true });
      }

      // Move file
      fs.renameSync(oldPath, newPath);
      console.log(`  ✓ Migrated: ${file} → prompts/${tag}/${title}.md`);
      result.success++;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ✗ Error: ${file} - ${errorMsg}`);
      result.errors.push({ file, error: errorMsg });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary:');
  console.log(`  ✓ Successfully migrated: ${result.success}`);
  console.log(`  ⊘ Skipped: ${result.skipped}`);
  console.log(`  ✗ Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
  }

  return result;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: ts-node migrate.ts <path-to-prompts-folder>');
    console.log('\nExample:');
    console.log('  ts-node migrate.ts /Users/username/Documents/MyPrompts');
    process.exit(1);
  }

  const folderPath = args[0];
  const result = migratePromptsFolder(folderPath);

  // Exit with error code if there were errors
  process.exit(result.errors.length > 0 ? 1 : 0);
}

export { migratePromptsFolder };
