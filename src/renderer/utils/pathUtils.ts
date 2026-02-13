
/**
 * Parses a dot-notation path into tag and title components.
 * e.g., "work.email.draft" -> { tag: "work-email", title: "draft" }
 */
export const parsePathForPrompt = (pathValue: string): { tag: string; title: string } => {
    const parts = pathValue.split('.');
    if (parts.length === 1) {
        return { tag: '', title: parts[0] };
    }
    const title = parts.pop() || '';
    const tag = parts.join('-');
    return { tag, title };
};
