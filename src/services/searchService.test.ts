
import { SearchService } from './searchService';
import { Prompt } from '../types';

describe('SearchService', () => {
    let searchService: SearchService;
    const mockPrompts: Prompt[] = [
        { id: '1', title: 'Welcome', tag: 'com', content: 'Hello world', filePath: 'p1', parameters: [], partials: [], partialPickers: [] },
        { id: '2', title: 'Work', tag: 'job', content: 'Do work', filePath: 'p2', parameters: [], partials: [], partialPickers: [] },
        { id: '3', title: 'Hello', tag: 'greet', content: 'Hi there', filePath: 'p3', parameters: [], partials: [], partialPickers: [] }
    ];

    beforeEach(() => {
        searchService = new SearchService();
        searchService.rebuildIndex(mockPrompts);
    });

    it('should find partial matches (prefix)', () => {
        const results = searchService.search('wel', mockPrompts);
        expect(results.length).toBe(1);
        expect(results[0].prompt.title).toBe('Welcome');
    });

    it('should find multiple matches with shared prefix', () => {
        const results = searchService.search('w', mockPrompts);
        // Should find Welcome and Work
        expect(results.length).toBe(2);
        const titles = results.map(r => r.prompt.title).sort();
        expect(titles).toEqual(['Welcome', 'Work']);
    });

    it('should handle exact match still', () => {
        const results = searchService.search('Welcome', mockPrompts);
        expect(results.length).toBe(1);
        expect(results[0].prompt.title).toBe('Welcome');
    });

    it('should handle multiple terms', () => {
        const results = searchService.search('wel wor', mockPrompts);
        // Lunr default is OR for multiple terms unless + is used? 
        // actually Lunr query string parser: "foo bar" is "foo OR bar" usually.
        // Let's verify behavior. If it finds either, we expect 2.
        expect(results.length).toBe(2);
    });

    it('should return empty for no match', () => {
        const results = searchService.search('xyz', mockPrompts);
        expect(results.length).toBe(0);
    });
});
