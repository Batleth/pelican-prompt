import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { PromptManager } from '../../promptManager';

const EXPORT_PREFIX = 'PELICAN:';
const EXPORT_VERSION = 1;

export interface ExportItem {
    type: 'prompt' | 'partial';
    relativePath: string; // e.g. "coding/my-prompt.md" or "utils/header.md"
    content: string;
}

export interface ExportPayload {
    version: number;
    source: string;
    timestamp: number;
    items: ExportItem[];
}

export interface ConflictItem {
    item: ExportItem;
    status: 'new' | 'conflict' | 'identical';
    existingContent?: string;
}

export interface ConflictReport {
    items: ConflictItem[];
}

/**
 * Recursively extract partial references from content.
 * Returns dot-notation paths like "utils.header".
 */
function extractPartialRefs(content: string): string[] {
    const regex = /\{\{>\s*([^}]+)\s*\}\}/g;
    const refs: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        const tagContent = match[1].trim();
        // Skip dynamic pickers (contain *)
        if (!tagContent.includes('*')) {
            if (!refs.includes(tagContent)) {
                refs.push(tagContent);
            }
        }
    }
    return refs;
}

/**
 * Generate an export string for a prompt and its dependencies.
 */
export async function generateExportString(
    promptFilePath: string,
    pm: PromptManager
): Promise<string> {
    const promptsFolder = pm.getPromptsFolder();
    const partialsFolder = pm.getPartialsFolder();

    // Read the prompt
    const promptContent = fs.readFileSync(promptFilePath, 'utf-8');
    const promptRelPath = path.relative(promptsFolder, promptFilePath).replace(/\\/g, '/');

    const items: ExportItem[] = [
        { type: 'prompt', relativePath: promptRelPath, content: promptContent }
    ];

    // Collect partials recursively
    const visited = new Set<string>();
    const queue = extractPartialRefs(promptContent);

    while (queue.length > 0) {
        const dotPath = queue.shift()!;
        if (visited.has(dotPath)) continue;
        visited.add(dotPath);

        const partial = pm.getPartial(dotPath);
        if (partial) {
            const partialRelPath = path.relative(partialsFolder, partial.filePath).replace(/\\/g, '/');
            items.push({
                type: 'partial',
                relativePath: partialRelPath,
                content: partial.content
            });

            // Partials technically shouldn't reference other partials in this app,
            // but let's be safe and check anyway
            const nestedRefs = extractPartialRefs(partial.content);
            for (const ref of nestedRefs) {
                if (!visited.has(ref)) {
                    queue.push(ref);
                }
            }
        }
    }

    const payload: ExportPayload = {
        version: EXPORT_VERSION,
        source: 'pelican-prompt',
        timestamp: Date.now(),
        items
    };

    // Compress and encode
    const json = JSON.stringify(payload);
    const compressed = zlib.gzipSync(Buffer.from(json, 'utf-8'));
    const base64 = compressed.toString('base64');

    return EXPORT_PREFIX + base64;
}

/**
 * Parse an import string back into a payload.
 */
export function parseImportString(importString: string): ExportPayload {
    const trimmed = importString.trim();
    if (!trimmed.startsWith(EXPORT_PREFIX)) {
        throw new Error('Invalid import string. Must start with "PELICAN:"');
    }

    const base64 = trimmed.slice(EXPORT_PREFIX.length);
    let decompressed: Buffer;
    try {
        const compressed = Buffer.from(base64, 'base64');
        decompressed = zlib.gunzipSync(compressed);
    } catch (e) {
        throw new Error('Failed to decode import string. It may be corrupted.');
    }

    let payload: ExportPayload;
    try {
        payload = JSON.parse(decompressed.toString('utf-8'));
    } catch (e) {
        throw new Error('Failed to parse import data. Invalid format.');
    }

    if (!payload.version || !payload.items || !Array.isArray(payload.items)) {
        throw new Error('Invalid import payload structure.');
    }

    return payload;
}

/**
 * Check for conflicts between import items and existing files.
 */
export function checkConflicts(
    payload: ExportPayload,
    pm: PromptManager
): ConflictReport {
    const promptsFolder = pm.getPromptsFolder();
    const partialsFolder = pm.getPartialsFolder();

    const items: ConflictItem[] = payload.items.map(item => {
        const baseFolder = item.type === 'prompt' ? promptsFolder : partialsFolder;
        const fullPath = path.join(baseFolder, item.relativePath.replace(/\//g, path.sep));

        if (fs.existsSync(fullPath)) {
            const existingContent = fs.readFileSync(fullPath, 'utf-8');
            if (existingContent === item.content) {
                return { item, status: 'identical' as const, existingContent };
            }
            return { item, status: 'conflict' as const, existingContent };
        }
        return { item, status: 'new' as const };
    });

    return { items };
}

/**
 * Execute the import — write files to disk.
 * @param payload The parsed import payload.
 * @param pm The PromptManager to write to.
 * @param overwriteIndices The indices of items the user chose to overwrite.
 */
export function executeImport(
    payload: ExportPayload,
    pm: PromptManager,
    overwriteIndices: number[]
): { imported: number; skipped: number } {
    const promptsFolder = pm.getPromptsFolder();
    const partialsFolder = pm.getPartialsFolder();
    const overwriteSet = new Set(overwriteIndices);

    let imported = 0;
    let skipped = 0;

    payload.items.forEach((item, index) => {
        const baseFolder = item.type === 'prompt' ? promptsFolder : partialsFolder;
        const fullPath = path.join(baseFolder, item.relativePath.replace(/\//g, path.sep));

        const exists = fs.existsSync(fullPath);
        if (exists && !overwriteSet.has(index)) {
            // Check if identical — still count as imported
            const existing = fs.readFileSync(fullPath, 'utf-8');
            if (existing === item.content) {
                imported++;
            } else {
                skipped++;
            }
            return;
        }

        // Ensure directory exists
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, item.content, 'utf-8');
        imported++;
    });

    return { imported, skipped };
}
