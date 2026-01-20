# Testing the Hierarchical Tag System

This document provides manual testing instructions for the new hierarchical tag system.

## Test Environment Setup

The example-prompts folder has been migrated and now contains:

```
example-prompts/prompts/
├── code/
│   ├── Python_Function.md (tag: code)
│   └── python/
│       └── async/
│           └── utils/
│               └── Retry_Logic.md (tag: code-python-async-utils)
├── com/
│   └── mail/
│       └── formal/
│           └── Business_Letter.md (tag: com-mail-formal)
├── email/
│   └── Professional_Reply.md (tag: email)
└── work/
    └── Meeting_Notes.md (tag: work)
```

## Manual Testing Steps

### 1. Start the Application
```bash
npm start
```

### 2. Configure Prompts Folder
1. Press `Cmd+K` to open search window
2. Click "Select Folder" or "Change Folder"
3. Select `example-prompts` folder
4. App will automatically look for prompts in `example-prompts/prompts/`

### 3. Test Search Functionality

#### Test 3.1: View All Prompts
- Open search (`Cmd+K`)
- Leave search box empty
- **Expected**: See all 5 prompts with their hierarchical tags displayed

#### Test 3.2: Exact Tag Match
- Search: `tag:code`
- **Expected**: Only `Python_Function.md` (tag: `code`)
- Search: `tag:work`
- **Expected**: Only `Meeting_Notes.md` (tag: `work`)
- Search: `tag:com-mail-formal`
- **Expected**: Only `Business_Letter.md` (tag: `com-mail-formal`)

#### Test 3.3: Wildcard Tag Search (Prefix Matching)
- Search: `tag:code*`
- **Expected**: Both `Python_Function.md` (tag: `code`) AND `Retry_Logic.md` (tag: `code-python-async-utils`)
- Search: `tag:com*`
- **Expected**: Only `Business_Letter.md` (tag: `com-mail-formal`)
- Search: `tag:code-python*`
- **Expected**: Only `Retry_Logic.md` (tag: `code-python-async-utils`)

#### Test 3.4: Text Search
- Search: `python`
- **Expected**: Both `Python_Function.md` and `Retry_Logic.md`
- Search: `letter`
- **Expected**: Only `Business_Letter.md`

#### Test 3.5: Combined Search
- Search: `tag:code* retry`
- **Expected**: Only `Retry_Logic.md` (has tag starting with `code` AND contains text `retry`)

### 4. Test Prompt Creation

#### Test 4.1: Create Single-Level Tag
1. Press `Cmd+N` to create new prompt
2. Tag: `test`
3. Title: `Single Level Test`
4. Content: `This is a test prompt`
5. Save
6. **Expected**: File created at `prompts/test/Single_Level_Test.md`

#### Test 4.2: Create Multi-Level Tag (3 levels)
1. Press `Cmd+N`
2. Tag: `work-project-planning`
3. Title: `Project Plan Template`
4. Content: `Project: [PROJECT_NAME]`
5. Save
6. **Expected**: File created at `prompts/work/project/planning/Project_Plan_Template.md`

#### Test 4.3: Create Deep Tag (5 levels - maximum)
1. Press `Cmd+N`
2. Tag: `dev-lang-python-web-django`
3. Title: `Django View`
4. Content: `Create a Django view`
5. Save
6. **Expected**: File created at `prompts/dev/lang/python/web/django/Django_View.md`

#### Test 4.4: Attempt Too-Deep Tag (should fail)
1. Press `Cmd+N`
2. Tag: `a-b-c-d-e-f` (6 levels)
3. Title: `Should Fail`
4. Content: `Test`
5. Save
6. **Expected**: Error message: "Tag hierarchy cannot exceed 5 levels"

#### Test 4.5: Invalid Tag Characters
1. Press `Cmd+N`
2. Tag: `test@tag` (invalid character)
3. Try to save
4. **Expected**: Error: "Tag can only contain letters, numbers, underscores, and hyphens."

### 5. Test Prompt Editing

#### Test 5.1: Edit Existing Prompt (no tag change)
1. Open search
2. Select `Python_Function.md`
3. Press `Cmd+E` to edit
4. Change content
5. Save
6. **Expected**: File updated in same location `prompts/code/Python_Function.md`

#### Test 5.2: Edit Prompt with Tag Change (file should move)
1. Open search
2. Select `Python_Function.md` (tag: `code`)
3. Press `Cmd+E`
4. Change tag to: `code-lang-python`
5. Save
6. **Expected**: 
   - Old file deleted: `prompts/code/Python_Function.md`
   - New file created: `prompts/code/lang/python/Python_Function.md`
   - Old `code/` folder still exists (has other prompts)

### 6. Test Empty Folder Cleanup

#### Test 6.1: Create and Delete Isolated Prompt
1. Create new prompt with tag: `temporary-test-tag`
2. Verify folder exists: `prompts/temporary/test/tag/`
3. Select the prompt
4. Delete it (or edit and change tag to move it elsewhere)
5. **Expected**: 
   - Folders `prompts/temporary/test/tag/` automatically deleted
   - Folders `prompts/temporary/test/` automatically deleted
   - Folders `prompts/temporary/` automatically deleted
   - `prompts/` folder remains (never deleted)

#### Test 6.2: Delete One of Multiple Prompts in Same Folder
1. Note: `prompts/code/` has `Python_Function.md`
2. Create another prompt: tag `code`, title `Test 2`
3. Verify both files in `prompts/code/`
4. Delete `Test 2.md`
5. **Expected**: 
   - `Test 2.md` deleted
   - `prompts/code/` folder remains (still has `Python_Function.md`)

### 7. Test Tag Display in UI

#### Test 7.1: Verify Full Tag Display
1. Open search
2. View all prompts
3. **Expected**: Each prompt shows its full hierarchical tag
   - `code` displays as `code`
   - `com-mail-formal` displays as `com-mail-formal`
   - `code-python-async-utils` displays as `code-python-async-utils`
   - No truncation or ellipsis

### 8. Test Parameter Functionality (should still work)

1. Open `Business_Letter.md` (has [RECIPIENT], [SUBJECT], etc.)
2. Press Enter to select
3. **Expected**: Parameter dialog appears
4. Fill in values
5. Copy
6. **Expected**: Clipboard has content with parameters replaced

## Expected Results Summary

✅ All prompts load from `prompts/` subfolder
✅ Tags displayed as hierarchical (joined with hyphens)
✅ Exact tag search works: `tag:exact-match`
✅ Wildcard tag search works: `tag:prefix*`
✅ New prompts create nested folder structure
✅ 5-level depth limit enforced
✅ Tag validation prevents invalid characters
✅ Moving prompts (tag change) works correctly
✅ Empty folders automatically cleaned up
✅ Prompts folder never deleted
✅ Full tag names displayed in UI
✅ Parameters still work correctly

## Verification Commands

### Check folder structure:
```bash
tree example-prompts/prompts -L 5
# or
find example-prompts/prompts -name "*.md" | sort
```

### Verify file count:
```bash
find example-prompts/prompts -name "*.md" | wc -l
# Should show: 5
```

### Check for empty folders (should be none after cleanup):
```bash
find example-prompts/prompts -type d -empty
```

## Known Issues / Notes

1. **TypeScript Editor Warnings**: The editor shows TypeScript warnings for lunr library (implicit any types). These are pre-existing and don't affect runtime functionality. The webpack build configuration handles these correctly.

2. **Search Error on Empty Query**: If you see "QueryParseError: expecting term, found nothing" in console, it's from entering an invalid search pattern. This doesn't break functionality.

3. **File Watcher Delay**: Changes made directly to the file system (outside the app) may take a moment to reflect in the search window. Close and reopen (`Cmd+K`) to force reload.
