import lunr from 'lunr';
import { Prompt, SearchResult } from '../types';

export class SearchService {
  private searchIndex: lunr.Index | null = null;

  /**
   * Rebuild the search index from prompts
   */
  public rebuildIndex(prompts: Prompt[]): void {
    try {
      const documents = prompts.map(prompt => ({
        id: prompt.id,
        title: prompt.title,
        tag: prompt.tag,
        content: prompt.content
      }));

      if (documents.length === 0) {
        this.searchIndex = null;
        return;
      }

      this.searchIndex = lunr(function () {
        this.ref('id');
        this.field('title', { boost: 10 });
        this.field('tag', { boost: 5 });
        this.field('content');

        documents.forEach(doc => {
          this.add(doc);
        });
      });
    } catch (error) {
      console.error('Error rebuilding index:', error);
    }
  }

  /**
   * Search prompts by query
   */
  public search(query: string, prompts: Prompt[]): SearchResult[] {
    if (!this.searchIndex || query.trim() === '') {
      return prompts.map(prompt => ({
        prompt,
        score: 1
      }));
    }

    // Check for tag filter: tag:tagname or tag:prefix* or tag:*suffix or tag:*contains*
    const tagMatch = query.match(/tag:(\S+)/);
    let filteredPrompts = prompts;
    let searchQuery = query;

    if (tagMatch) {
      const tagFilter = tagMatch[1].toLowerCase();

      if (tagFilter.startsWith('*') && tagFilter.endsWith('*')) {
        // Contains wildcard: tag:*python* matches code-python-async, python-utils, etc.
        const contains = tagFilter.slice(1, -1);
        filteredPrompts = filteredPrompts.filter(p =>
          p.tag.toLowerCase().includes(contains)
        );
      } else if (tagFilter.startsWith('*')) {
        // Suffix wildcard: tag:*python matches code-python, lang-python, etc.
        const suffix = tagFilter.slice(1);
        filteredPrompts = filteredPrompts.filter(p =>
          p.tag.toLowerCase().endsWith(suffix) ||
          p.tag.toLowerCase().includes('-' + suffix)
        );
      } else if (tagFilter.endsWith('*')) {
        // Prefix wildcard: tag:code* matches code, code-python, code-js, etc.
        const prefix = tagFilter.slice(0, -1);
        filteredPrompts = filteredPrompts.filter(p =>
          p.tag.toLowerCase().startsWith(prefix)
        );
      } else {
        // Exact or prefix match: tag:com matches com, com-mail, com-meeting, etc.
        filteredPrompts = filteredPrompts.filter(p =>
          p.tag.toLowerCase() === tagFilter ||
          p.tag.toLowerCase().startsWith(tagFilter + '-')
        );
      }

      searchQuery = query.replace(/tag:\S+/g, '').trim();
    } else {
      // Remove incomplete "tag:" patterns (e.g., "tag:" or "tag: " without value)
      searchQuery = query.replace(/tag:\s*/g, '').trim();
    }

    // If only tag filter and no other search terms, return filtered results
    if (searchQuery === '') {
      return filteredPrompts.map(prompt => ({
        prompt,
        score: 1
      }));
    }

    try {
      // Fuzzy search: split by space and append * to each term for prefix matching
      const terms = searchQuery.split(/\s+/).filter(t => t.length > 0);
      const fuzzyQuery = terms.map(t => {
        // If term already has wildcard or specific field (e.g. title:foo), leave it.
        if (t.includes(':') || t.includes('*')) return t;
        // Search for term (boosted) OR term*
        return `${t}^2 ${t}*`;
      }).join(' ');

      // Use the fuzzy query if we have terms, else fallback to original (though it should be empty if terms empty)
      const finalQuery = fuzzyQuery || searchQuery;

      const results = this.searchIndex.search(finalQuery);
      const filteredIds = new Set(filteredPrompts.map(p => p.id));
      const promptMap = new Map(prompts.map(p => [p.id, p]));

      return results
        .filter(result => filteredIds.has(result.ref))
        .map(result => ({
          prompt: promptMap.get(result.ref)!,
          score: result.score
        }))
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }
}
