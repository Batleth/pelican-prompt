/**
 * @jest-environment jsdom
 */

// Mock electron API
Object.defineProperty(window, 'electronAPI', {
    value: {
        getTheme: jest.fn().mockResolvedValue('light'),
        onThemeChanged: jest.fn(),
        searchPrompts: jest.fn(),
        getAllPrompts: jest.fn(),
        getPromptsFolder: jest.fn(),
        resolvePartials: jest.fn(),
        copyToClipboard: jest.fn(),
        hideWindow: jest.fn(),
        onReloadPrompts: jest.fn(),
        deletePrompt: jest.fn(),
        openEditor: jest.fn(),
        openPartialsBrowser: jest.fn(),
        selectFolder: jest.fn(),
        savePrompt: jest.fn(),
        setTheme: jest.fn(),
        openFolderInFilesystem: jest.fn(),
        createWorkspace: jest.fn()
    },
    writable: true
});

import { SearchController } from '../SearchController';
import { SearchView } from '../SearchView';
import { Prompt, SearchResult } from '../../../types';

// Mock SearchView
const mockView = {
    getSearchInput: jest.fn(),
    setSearchValue: jest.fn(),
    focusSearchInput: jest.fn(),
    updateFolderDisplay: jest.fn(),
    renderNoFolderState: jest.fn(),
    renderMainLayout: jest.fn(),
    renderResults: jest.fn(),
    scrollToSelected: jest.fn(),
    applyTheme: jest.fn(),
    showToast: jest.fn(),
    showDeleteConfirmation: jest.fn(),
    showParameterDialog: jest.fn()
} as unknown as SearchView;

describe('SearchController', () => {
    let controller: SearchController;

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup default mocks
        (window.electronAPI.getTheme as jest.Mock).mockResolvedValue('light');
        (window.electronAPI.getPromptsFolder as jest.Mock).mockResolvedValue('/test/path');
        (window.electronAPI.getAllPrompts as jest.Mock).mockResolvedValue([]);
        (mockView.getSearchInput as jest.Mock).mockReturnValue({
            addEventListener: jest.fn(),
            focus: jest.fn(),
            value: ''
        });

        controller = new SearchController(mockView);
    });

    it('should initialize correctly', async () => {
        await controller.init();
        expect(window.electronAPI.getTheme).toHaveBeenCalled();
        expect(window.electronAPI.getPromptsFolder).toHaveBeenCalled();
        expect(mockView.applyTheme).toHaveBeenCalledWith('light');
        expect(mockView.renderMainLayout).toHaveBeenCalled();
    });

    it('should load prompts on init if folder exists', async () => {
        const mockPrompts: Prompt[] = [
            { id: '1', title: 'Test 1', content: 'Content', tag: 'test', filePath: 'p1', parameters: [], partials: [], partialPickers: [] }
        ];
        (window.electronAPI.getAllPrompts as jest.Mock).mockResolvedValue(mockPrompts);

        await controller.init();

        expect(window.electronAPI.getAllPrompts).toHaveBeenCalled();
        // verify renderResults was called with mapped results
        expect(mockView.renderResults).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ prompt: mockPrompts[0] })]),
            0,
            expect.any(String)
        );
    });

    it('should handle search input', async () => {
        const results: SearchResult[] = [
            { prompt: { id: '1', title: 'Result', content: '', tag: '', filePath: '', parameters: [], partials: [], partialPickers: [] }, score: 10 }
        ];
        (window.electronAPI.searchPrompts as jest.Mock).mockResolvedValue(results);

        await controller.handleSearch('query');

        expect(window.electronAPI.searchPrompts).toHaveBeenCalledWith('query');
        expect(mockView.renderResults).toHaveBeenCalledWith(results, 0, expect.any(String));
    });

    it('should navigate search results with keyboard', async () => {
        const mockPrompts: Prompt[] = [
            { id: '1', title: '1', content: '', tag: '', filePath: '', parameters: [], partials: [], partialPickers: [] },
            { id: '2', title: '2', content: '', tag: '', filePath: '', parameters: [], partials: [], partialPickers: [] }
        ];
        (window.electronAPI.getAllPrompts as jest.Mock).mockResolvedValue(mockPrompts);
        await controller.init(); // Loads items

        // Down
        controller.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(mockView.renderResults).toHaveBeenLastCalledWith(expect.anything(), 1, expect.any(String));

        // Up
        controller.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        expect(mockView.renderResults).toHaveBeenLastCalledWith(expect.anything(), 0, expect.any(String));
    });

    it('should select prompt on Enter', async () => {
        const mockPrompt: Prompt = { id: '1', title: '1', content: 'raw', tag: '', filePath: '', parameters: [], partials: [], partialPickers: [] };
        (window.electronAPI.getAllPrompts as jest.Mock).mockResolvedValue([mockPrompt]);
        (window.electronAPI.resolvePartials as jest.Mock).mockResolvedValue('resolved');

        await controller.init();

        controller.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

        // Should call selectPrompt -> copy (since no params)
        // Wait for async operations
        await new Promise(process.nextTick);

        expect(window.electronAPI.resolvePartials).toHaveBeenCalledWith('raw');
        expect(window.electronAPI.copyToClipboard).toHaveBeenCalledWith('resolved');
        expect(window.electronAPI.hideWindow).toHaveBeenCalled();
    });

    it('should show parameter dialog if prompt has parameters', async () => {
        const mockPrompt: Prompt = { id: '1', title: '1', content: '', tag: '', filePath: '', parameters: ['PARAM'], partials: [], partialPickers: [] };
        (window.electronAPI.getAllPrompts as jest.Mock).mockResolvedValue([mockPrompt]);

        await controller.init();
        controller.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

        expect(mockView.showParameterDialog).toHaveBeenCalledWith(mockPrompt, expect.anything());
    });
});
