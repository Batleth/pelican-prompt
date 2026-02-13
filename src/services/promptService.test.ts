import { PromptService } from './promptService';
import { TagService } from './tagService';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs and TagService
jest.mock('fs');
jest.mock('./tagService');

describe('PromptService', () => {
    let promptService: PromptService;
    let mockTagService: jest.Mocked<TagService>;
    const mockPromptsFolder = '/mock/prompts';

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mock implementations
        mockTagService = new TagService() as jest.Mocked<TagService>;
        mockTagService.extractTagFromPath.mockReturnValue('test-tag');
        mockTagService.validateTagDepth.mockReturnValue({ valid: true });
        mockTagService.buildFolderPath.mockReturnValue('/mock/prompts/test/tag');

        promptService = new PromptService(mockPromptsFolder, mockTagService);
    });

    describe('parsePromptFile', () => {
        it('should parse a simple prompt', () => {
            const filePath = '/mock/prompts/test.md';
            const content = 'Test content';
            (fs.readFileSync as jest.Mock).mockReturnValue(content);
            mockTagService.extractTagFromPath.mockReturnValue('test');

            const result = promptService.parsePromptFile(filePath);

            expect(result).toEqual({
                id: filePath,
                tag: 'test',
                title: 'test',
                content,
                filePath,
                parameters: [],
                partials: [],
                partialPickers: []
            });
        });

        it('should parse parameters with and without spaces', () => {
            const filePath = '/mock/prompts/params.md';
            const content = 'Hello {NAME}, welcome to { COMPANY } and {  TEST_PARAM  }.';
            (fs.readFileSync as jest.Mock).mockReturnValue(content);

            const result = promptService.parsePromptFile(filePath);

            expect(result?.parameters).toEqual(['NAME', 'COMPANY', 'TEST_PARAM']);
        });

        it('should parse static partials', () => {
            const filePath = '/mock/prompts/partials.md';
            const content = '{> header } Content {> footer }';
            (fs.readFileSync as jest.Mock).mockReturnValue(content);

            const result = promptService.parsePromptFile(filePath);

            expect(result?.partials).toEqual(['header', 'footer']);
        });

        it('should parse dynamic partial pickers', () => {
            const filePath = '/mock/prompts/dynamic.md';
            const content = '{> tones.mail.* } and {> signatures.* signatures.default }';
            (fs.readFileSync as jest.Mock).mockReturnValue(content);

            const result = promptService.parsePromptFile(filePath);

            expect(result?.partialPickers).toEqual([
                { path: 'tones.mail', defaultPath: undefined },
                { path: 'signatures', defaultPath: 'signatures.default' }
            ]);
        });
    });

    describe('savePrompt', () => {
        it('should save a new prompt', async () => {
            const tag = 'test-tag';
            const title = 'Test Prompt';
            const content = 'Test Content';
            (fs.existsSync as jest.Mock).mockReturnValue(false); // No existing file

            const result = await promptService.savePrompt(tag, title, content);

            expect(mockTagService.validateTagDepth).toHaveBeenCalledWith(tag);
            expect(mockTagService.buildFolderPath).toHaveBeenCalledWith(mockPromptsFolder, tag);
            expect(mockTagService.ensureFolderExists).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(result).toContain('Test Prompt.md');
        });

        it('should throw error if tag is invalid', async () => {
            mockTagService.validateTagDepth.mockReturnValue({ valid: false, error: 'Invalid tag' });

            await expect(promptService.savePrompt('invalid', 'Title', 'Content'))
                .rejects.toThrow('Invalid tag');
        });
    });

    describe('getAllUniqueParameters', () => {
        it('should return all unique parameters from loaded prompts', () => {
            // Simulate loading first prompt
            const p1 = '/mock/prompts/p1.md';
            const c1 = 'Hello {NAME}';
            (fs.readFileSync as jest.Mock).mockReturnValue(c1);
            mockTagService.extractTagFromPath.mockReturnValue('tag1');
            promptService.handleFileChange(p1);

            // Simulate loading second prompt
            const p2 = '/mock/prompts/p2.md';
            const c2 = 'Welcome {NAME} to {COMPANY}';
            (fs.readFileSync as jest.Mock).mockReturnValue(c2);
            mockTagService.extractTagFromPath.mockReturnValue('tag2');
            promptService.handleFileChange(p2);

            const params = promptService.getAllUniqueParameters();
            expect(params).toEqual(['COMPANY', 'NAME']);
        });
    });
});
