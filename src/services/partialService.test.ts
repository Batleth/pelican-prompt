import { PartialService } from './partialService';
import { TagService } from './tagService';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs and TagService
jest.mock('fs');
jest.mock('./tagService');

describe('PartialService', () => {
    let partialService: PartialService;
    let mockTagService: jest.Mocked<TagService>;
    const mockPartialsFolder = '/mock/partials';

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mock implementations
        mockTagService = new TagService() as jest.Mocked<TagService>;
        mockTagService.ensureFolderExists.mockImplementation(() => { });
        mockTagService.getMaxDepth.mockReturnValue(5);

        partialService = new PartialService(mockPartialsFolder, mockTagService);
    });

    describe('loadPartials', () => {
        it('should load partials recursively', () => {
            // Mock fs.readdirSync to return a file structure
            (fs.readdirSync as jest.Mock).mockImplementation((dir) => {
                if (dir === mockPartialsFolder) {
                    return [
                        { name: 'header.md', isFile: () => true, isDirectory: () => false },
                        { name: 'signatures', isFile: () => false, isDirectory: () => true }
                    ];
                }
                if (dir === path.join(mockPartialsFolder, 'signatures')) {
                    return [
                        { name: 'default.md', isFile: () => true, isDirectory: () => false }
                    ];
                }
                return [];
            });

            // Mock fs.readFileSync
            (fs.readFileSync as jest.Mock).mockReturnValue('Partial Content');
            (fs.existsSync as jest.Mock).mockReturnValue(true);

            partialService.loadPartials();

            const partials = partialService.getAllPartials();
            expect(partials).toHaveLength(2);
            expect(partials.map(p => p.path)).toContain('header');
            expect(partials.map(p => p.path)).toContain('signatures.default');
        });
    });

    describe('resolvePartials', () => {
        it('should resolve static partials', () => {
            // Manually inject partials
            (partialService as any).partials.set('header', { content: 'Header Content' });
            (partialService as any).partials.set('footer', { content: 'Footer Content' });

            const content = '{> header } Content {> footer }';
            const resolved = partialService.resolvePartials(content);

            expect(resolved).toBe('Header Content Content Footer Content');
        });

        it('should return MISSING PARTIAL for unknown partials', () => {
            const content = '{> unknown }';
            const resolved = partialService.resolvePartials(content);

            expect(resolved).toBe('MISSING PARTIAL unknown');
        });
    });

    describe('getPartialsInFolder', () => {
        beforeEach(() => {
            (partialService as any).partials.set('colors.red', { content: 'Red' });
            (partialService as any).partials.set('colors.blue', { content: 'Blue' });
            (partialService as any).partials.set('colors.pastel.green', { content: 'Pastel Green' });
            (partialService as any).partials.set('shapes.circle', { content: 'Circle' });
        });

        it('should return direct children of a folder', () => {
            const result = partialService.getPartialsInFolder('colors');
            expect(result).toHaveLength(2);
            expect(result.map(p => p.path)).toContain('colors.red');
            expect(result.map(p => p.path)).toContain('colors.blue');
            expect(result.map(p => p.path)).not.toContain('colors.pastel.green');
        });

        it('should return empty list for non-existent folder', () => {
            const result = partialService.getPartialsInFolder('animals');
            expect(result).toHaveLength(0);
        });
    });

    describe('deletePartial', () => {
        it('should delete existing file', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.unlinkSync as jest.Mock).mockImplementation(() => { });

            await partialService.deletePartial('/mock/partials/test.md');

            expect(fs.unlinkSync).toHaveBeenCalledWith('/mock/partials/test.md');
        });
    });

    describe('Path Handling', () => {
        it('should handle Windows separators correctly', () => {
            // We need to access private method or test via loadPartials logic
            // But since filePathToDotPath is private, let's test via handlePartialChange which uses it
            const weirdPath = path.join(mockPartialsFolder, 'subfolder', 'deep', 'file.md');
            // On windows this will be ...\subfolder\deep\file.md

            (fs.readFileSync as jest.Mock).mockReturnValue('content');

            partialService.handlePartialChange(weirdPath);

            const expectedDotPath = 'subfolder.deep.file';
            const partial = partialService.getPartial(expectedDotPath);

            expect(partial).not.toBeNull();
            expect(partial?.content).toBe('content');
        });
    });
});
