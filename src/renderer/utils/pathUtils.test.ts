
import { parsePathForPrompt } from './pathUtils';

describe('pathUtils', () => {
    describe('parsePathForPrompt', () => {
        it('should parse simple title', () => {
            const result = parsePathForPrompt('simple');
            expect(result).toEqual({ tag: '', title: 'simple' });
        });

        it('should parse tag and title', () => {
            const result = parsePathForPrompt('tag.title');
            expect(result).toEqual({ tag: 'tag', title: 'title' });
        });

        it('should parse nested tag and title', () => {
            const result = parsePathForPrompt('my.nested.tag.title');
            expect(result).toEqual({ tag: 'my-nested-tag', title: 'title' });
        });

        it('should handle empty string', () => {
            const result = parsePathForPrompt('');
            expect(result).toEqual({ tag: '', title: '' });
        });
    });
});
