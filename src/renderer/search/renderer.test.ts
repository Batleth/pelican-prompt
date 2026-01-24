/**
 * @jest-environment jsdom
 */
// Mock global window properties before importing logic
Object.defineProperty(window, 'electronAPI', {
    value: {
        getTheme: jest.fn().mockResolvedValue('light'),
        onThemeChanged: jest.fn(),
        searchPrompts: jest.fn(),
        resolvePartials: jest.fn(),
        copyToClipboard: jest.fn(),
        hideWindow: jest.fn(),
        getPartialsInFolder: jest.fn(),
        getPartial: jest.fn(),
        onShowSearch: jest.fn(),
        onReloadPrompts: jest.fn(),
        getPromptsFolder: jest.fn().mockResolvedValue('/mock/folder'),
        getAllPrompts: jest.fn().mockResolvedValue([]),
    },
    writable: true
});

import { handleKeyDown } from './renderer_logic';
import { Prompt } from '../../types';

describe('Renderer Logic - Keyboard Navigation', () => {
    let state: {
        selectedIndex: number;
        maxIndex: number;
        prompts: Prompt[];
    };

    let callbacks: {
        setSelectedIndex: jest.Mock;
        selectPrompt: jest.Mock;
        toggleTheme: jest.Mock;
        createNewPrompt: jest.Mock;
        editPrompt: jest.Mock;
    };

    const mockPrompts: Prompt[] = [
        { id: '1', title: 'P1', content: '', tag: 't', filePath: 'p1', parameters: [], partials: [], partialPickers: [] },
        { id: '2', title: 'P2', content: '', tag: 't', filePath: 'p2', parameters: [], partials: [], partialPickers: [] },
        { id: '3', title: 'P3', content: '', tag: 't', filePath: 'p3', parameters: [], partials: [], partialPickers: [] },
    ];

    beforeEach(() => {
        state = {
            selectedIndex: 0,
            maxIndex: 2,
            prompts: mockPrompts
        };

        callbacks = {
            setSelectedIndex: jest.fn(),
            selectPrompt: jest.fn(),
            toggleTheme: jest.fn(),
            createNewPrompt: jest.fn(),
            editPrompt: jest.fn()
        };
    });

    it('should navigate down correctly', async () => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        await handleKeyDown(event, state, callbacks);

        expect(callbacks.setSelectedIndex).toHaveBeenCalledWith(1);
    });

    it('should loop around when navigating down from last item', async () => {
        state.selectedIndex = 2;
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        await handleKeyDown(event, state, callbacks);

        expect(callbacks.setSelectedIndex).toHaveBeenCalledWith(0);
    });

    it('should navigate up correctly', async () => {
        state.selectedIndex = 1;
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        await handleKeyDown(event, state, callbacks);

        expect(callbacks.setSelectedIndex).toHaveBeenCalledWith(0);
    });

    it('should loop around when navigating up from first item', async () => {
        state.selectedIndex = 0;
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        await handleKeyDown(event, state, callbacks);

        expect(callbacks.setSelectedIndex).toHaveBeenCalledWith(2);
    });

    it('should select prompt on Enter', async () => {
        state.selectedIndex = 1;
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        await handleKeyDown(event, state, callbacks);

        expect(callbacks.selectPrompt).toHaveBeenCalledWith(mockPrompts[1]);
    });

    it('should trigger Create New Prompt with Cmd+N', async () => {
        const event = new KeyboardEvent('keydown', { key: 'n', metaKey: true });
        await handleKeyDown(event, state, callbacks);

        expect(callbacks.createNewPrompt).toHaveBeenCalled();
    });
});
