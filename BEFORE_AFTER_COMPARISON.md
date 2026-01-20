# Before & After Comparison

## Tag System Architecture

### BEFORE: Flat Filename-Based Tags

```
user-selected-folder/
  work_Meeting_Notes.md
  code_Python_Function.md
  email_Professional_Reply.md
```

**Tag Extraction:**
- Filename: `tag_Title.md`
- Split on underscore `_`
- First part = tag
- Rest = title

**Limitations:**
- Only single-level tags
- No tag hierarchy
- Tag embedded in filename (harder to reorganize)
- Underscores in title must be preserved

---

### AFTER: Hierarchical Folder-Based Tags

```
user-selected-folder/
  prompts/
    work/
      Meeting_Notes.md
    code/
      Python_Function.md
      python/
        async/
          utils/
            Retry_Logic.md
    email/
      Professional_Reply.md
    com/
      mail/
        formal/
          Business_Letter.md
```

**Tag Extraction:**
- Folder path: `prompts/tag/sub/sub2/File.md`
- Extract relative path from `prompts/`
- Split on path separator
- Join with hyphens: `tag-sub-sub2`

**Advantages:**
- Multi-level hierarchy (up to 5 levels)
- Visual organization in file system
- Easier to browse and reorganize
- Clean filenames (just title)
- Wildcard search support

---

## Feature Comparison

| Feature | Before | After |
|---------|--------|-------|
| **Tag Format** | Single flat tag | Hierarchical (max 5 levels) |
| **Filename** | `tag_Title.md` | `Title.md` |
| **Folder Structure** | Flat (all files in root) | Nested by tag hierarchy |
| **Tag Characters** | `a-zA-Z0-9_` | `a-zA-Z0-9_-` (added hyphen) |
| **Tag Search** | Exact match only | Exact + Wildcard prefix |
| **Organization** | Manual (rename files) | Visual (folder structure) |
| **Empty Cleanup** | Manual | Automatic |
| **Max Complexity** | 1 tag per prompt | 5-level hierarchy |

---

## Code Examples

### Tag Parsing

#### BEFORE:
```typescript
const filename = path.basename(filePath, '.md');
const parts = filename.split('_');
let tag = '';
let title = filename;

if (parts.length >= 2) {
  tag = parts[0];
  title = parts.slice(1).join('_');
}
```

#### AFTER:
```typescript
const filename = path.basename(filePath, '.md');
const title = filename;

// Extract tag from folder path hierarchy
const relativePath = path.relative(this.promptsFolder, path.dirname(filePath));
const pathSegments = relativePath === '.' ? [] : relativePath.split(path.sep);
const tag = pathSegments.length > 0 ? pathSegments.join('-') : '';
```

---

### File Scanning

#### BEFORE:
```typescript
private loadPrompts(): void {
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
}
```

#### AFTER:
```typescript
private loadPrompts(): void {
  if (!fs.existsSync(this.promptsFolder)) {
    fs.mkdirSync(this.promptsFolder, { recursive: true });
  }
  
  this.prompts.clear();
  this.loadPromptsRecursive(this.promptsFolder, 0);
  this.rebuildIndex();
}

private loadPromptsRecursive(dir: string, depth: number): void {
  if (depth > this.MAX_TAG_DEPTH) return;

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
```

---

### File Saving

#### BEFORE:
```typescript
public async savePrompt(
  tag: string, 
  title: string, 
  content: string, 
  existingPath?: string
): Promise<string> {
  const filename = `${tag}_${title}.md`;
  const newPath = path.join(this.promptsFolder, filename);

  if (existingPath && existingPath !== newPath && fs.existsSync(existingPath)) {
    fs.unlinkSync(existingPath);
  }

  fs.writeFileSync(newPath, content, 'utf-8');
  return newPath;
}
```

#### AFTER:
```typescript
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

  // If editing with different path, remove old file
  if (existingPath && existingPath !== newPath && fs.existsSync(existingPath)) {
    fs.unlinkSync(existingPath);
    this.cleanupEmptyFolders(path.dirname(existingPath));
  }

  fs.writeFileSync(newPath, content, 'utf-8');
  return newPath;
}
```

---

### Tag Filtering

#### BEFORE:
```typescript
// Only exact match
if (tagMatch) {
  const tagFilter = tagMatch[1].toLowerCase();
  filteredPrompts = filteredPrompts.filter(p => 
    p.tag.toLowerCase() === tagFilter
  );
}
```

#### AFTER:
```typescript
// Exact match OR wildcard prefix
if (tagMatch) {
  const tagFilter = tagMatch[1].toLowerCase();
  
  if (tagFilter.endsWith('*')) {
    // Wildcard prefix matching
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
}
```

---

## Search Examples

### BEFORE:
```
tag:work              → Matches: work_Meeting_Notes.md
tag:code              → Matches: code_Python_Function.md
tag:email             → Matches: email_Professional_Reply.md
```

### AFTER:
```
tag:work              → Matches: prompts/work/Meeting_Notes.md (tag: work)

tag:code              → Matches: prompts/code/Python_Function.md (tag: code)

tag:code*             → Matches: 
                          - prompts/code/Python_Function.md (tag: code)
                          - prompts/code/python/async/utils/Retry_Logic.md 
                            (tag: code-python-async-utils)

tag:com-mail-formal   → Matches: prompts/com/mail/formal/Business_Letter.md
                                 (tag: com-mail-formal)

tag:com*              → Matches: All prompts with tags starting with "com-"
```

---

## UI Changes

### Tag Input Field

#### BEFORE:
```html
<label for="tag-input">Tag</label>
<input type="text" id="tag-input" placeholder="work" />
<div class="hint">Single tag for categorization</div>
```

**Validation:** `/^[a-zA-Z0-9_]+$/`

#### AFTER:
```html
<label for="tag-input">Tag</label>
<input type="text" id="tag-input" placeholder="com-mail" />
<div class="hint">
  Hierarchical tag using hyphens 
  (e.g., com-mail-formal, code-python-async). Max 5 levels.
</div>
```

**Validation:** 
- Pattern: `/^[a-zA-Z0-9_-]+$/`
- Depth check: `tag.split('-').length <= 5`

---

### Search Placeholder

#### BEFORE:
```
"Search prompts... (e.g., 'tag:work project' or 'meeting')"
```

#### AFTER:
```
"Search prompts... (e.g., 'tag:com-mail', 'tag:code*', or 'meeting')"
```

---

## Migration Path

### Old Structure:
```
MyPrompts/
  ├── work_Meeting_Notes.md
  ├── code_Python_Function.md
  └── email_Professional_Reply.md
```

### Migration Command:
```bash
npx ts-node migrate.ts MyPrompts
```

### New Structure:
```
MyPrompts/
  ├── prompts/                    # Auto-created
  │   ├── work/
  │   │   └── Meeting_Notes.md
  │   ├── code/
  │   │   └── Python_Function.md
  │   └── email/
  │       └── Professional_Reply.md
  └── README.md                   # Non-.md files preserved in root
```

---

## Real-World Examples

### Email Management

#### BEFORE:
```
emails/
  email_Client_Response.md
  email_Internal_Memo.md
  email_Newsletter.md
```
*Limited to one tag per email type*

#### AFTER:
```
emails/prompts/
  com/
    client/
      formal/
        Response.md
        Follow_Up.md
      casual/
        Quick_Reply.md
    internal/
      memo/
        Weekly_Update.md
        Project_Status.md
    marketing/
      newsletter/
        Monthly.md
        Announcement.md
```
*Rich hierarchy for better organization*

---

### Code Templates

#### BEFORE:
```
code-templates/
  python_Function.md
  python_Class.md
  javascript_Component.md
  javascript_Hook.md
```
*Flat list, hard to navigate*

#### AFTER:
```
code-templates/prompts/
  python/
    basic/
      Function.md
      Class.md
    async/
      AsyncFunction.md
      Context_Manager.md
    web/
      django/
        View.md
        Model.md
      flask/
        Route.md
        Blueprint.md
  javascript/
    react/
      Component.md
      Hook.md
    node/
      Express_Route.md
      Middleware.md
```
*Organized by language → framework → type*

---

## Breaking Changes

⚠️ **File Structure Change**
- Old: All `.md` files in selected folder root
- New: All `.md` files in `prompts/` subfolder with nested structure

⚠️ **Filename Format Change**
- Old: `tag_Title.md`
- New: `Title.md` (tag from folder path)

⚠️ **Migration Required**
- Use `migrate.ts` script to convert existing prompts
- No automatic migration on app startup (dev-only feature)

---

## Backward Compatibility

**Not Supported:**
- Old `tag_Title.md` files will not be automatically detected
- Must run migration script manually
- After migration, old files remain (can be deleted manually)

**Rationale:**
- Dev-only tool (not shipped product)
- Clean break preferred over maintaining dual format support
- One-time migration is simpler than ongoing compatibility layer
