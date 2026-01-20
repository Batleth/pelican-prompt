/**
 * Test script for empty folder cleanup functionality
 * 
 * This verifies that empty tag folders are automatically deleted
 */

import * as fs from 'fs';
import * as path from 'path';
import { PromptManager } from './src/promptManager';

async function testEmptyFolderCleanup() {
  console.log('Testing empty folder cleanup functionality...\n');
  
  // Create a temporary test folder
  const testFolder = path.join(__dirname, 'test-cleanup');
  const promptsFolder = path.join(testFolder, 'prompts');
  
  // Clean up any existing test folder
  if (fs.existsSync(testFolder)) {
    fs.rmSync(testFolder, { recursive: true });
  }
  
  // Create test structure
  fs.mkdirSync(testFolder, { recursive: true });
  
  console.log('✓ Created test folder:', testFolder);
  
  // Initialize PromptManager (this will create prompts/ subfolder)
  const manager = new PromptManager(testFolder);
  
  console.log('✓ Initialized PromptManager');
  console.log('✓ Created prompts/ subfolder:', promptsFolder);
  
  // Test 1: Create a prompt with nested tag
  console.log('\n--- Test 1: Create nested tag prompt ---');
  const filePath = await manager.savePrompt(
    'test-nested-tag',
    'Test Prompt',
    'This is a test prompt with [PARAM]'
  );
  
  console.log('✓ Created:', filePath);
  
  // Verify folder structure exists
  const tagFolder = path.join(promptsFolder, 'test', 'nested', 'tag');
  if (fs.existsSync(tagFolder)) {
    console.log('✓ Folder structure created:', tagFolder);
  } else {
    console.log('✗ ERROR: Folder structure not created');
  }
  
  // Test 2: Delete the prompt and verify cleanup
  console.log('\n--- Test 2: Delete prompt and verify cleanup ---');
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log('✓ Deleted prompt file:', filePath);
    
    // Manually trigger cleanup (simulate what happens in handleFileRemove)
    const dirPath = path.dirname(filePath);
    // Note: In real app, this is called automatically by handleFileRemove
    // For testing, we need to call it manually since we're not going through the watcher
    (manager as any).cleanupEmptyFolders(dirPath);
    
    // Verify all empty folders are removed
    if (!fs.existsSync(tagFolder)) {
      console.log('✓ Empty folder cleaned up:', tagFolder);
    } else {
      console.log('✗ ERROR: Empty folder still exists:', tagFolder);
    }
    
    const parentFolder = path.join(promptsFolder, 'test', 'nested');
    if (!fs.existsSync(parentFolder)) {
      console.log('✓ Parent folder cleaned up:', parentFolder);
    } else {
      console.log('✗ ERROR: Parent folder still exists:', parentFolder);
    }
    
    const rootTagFolder = path.join(promptsFolder, 'test');
    if (!fs.existsSync(rootTagFolder)) {
      console.log('✓ Root tag folder cleaned up:', rootTagFolder);
    } else {
      console.log('✗ ERROR: Root tag folder still exists:', rootTagFolder);
    }
    
    // Verify prompts folder still exists (should never be deleted)
    if (fs.existsSync(promptsFolder)) {
      console.log('✓ Prompts/ folder preserved (not deleted)');
    } else {
      console.log('✗ ERROR: Prompts/ folder was deleted!');
    }
  }
  
  // Test 3: Multiple prompts in same hierarchy
  console.log('\n--- Test 3: Multiple prompts, partial cleanup ---');
  
  await manager.savePrompt('shared-tag', 'First', 'First prompt');
  await manager.savePrompt('shared-tag', 'Second', 'Second prompt');
  
  const firstPath = path.join(promptsFolder, 'shared', 'tag', 'First.md');
  const secondPath = path.join(promptsFolder, 'shared', 'tag', 'Second.md');
  
  console.log('✓ Created two prompts with same tag');
  
  // Delete only the first one
  if (fs.existsSync(firstPath)) {
    fs.unlinkSync(firstPath);
    (manager as any).cleanupEmptyFolders(path.dirname(firstPath));
    console.log('✓ Deleted first prompt');
  }
  
  const sharedTagFolder = path.join(promptsFolder, 'shared', 'tag');
  if (fs.existsSync(sharedTagFolder)) {
    console.log('✓ Folder preserved (still has Second.md):', sharedTagFolder);
  } else {
    console.log('✗ ERROR: Folder deleted too early (Second.md still exists)');
  }
  
  // Delete the second one
  if (fs.existsSync(secondPath)) {
    fs.unlinkSync(secondPath);
    (manager as any).cleanupEmptyFolders(path.dirname(secondPath));
    console.log('✓ Deleted second prompt');
  }
  
  if (!fs.existsSync(sharedTagFolder)) {
    console.log('✓ Now folder is cleaned up (no more prompts)');
  } else {
    console.log('✗ ERROR: Folder not cleaned up after last prompt deleted');
  }
  
  // Cleanup test folder
  console.log('\n--- Cleanup ---');
  manager.destroy();
  fs.rmSync(testFolder, { recursive: true });
  console.log('✓ Test folder removed');
  
  console.log('\n✓ All tests completed!');
}

// Run tests
testEmptyFolderCleanup().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
