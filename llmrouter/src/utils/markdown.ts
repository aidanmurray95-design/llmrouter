import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Custom renderer for code blocks with syntax highlighting class
const renderer = new marked.Renderer();
renderer.code = (code: string, language: string | undefined) => {
  const lang = language || 'plaintext';
  return `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
};

marked.use({ renderer });

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export function renderMarkdown(content: string): string {
  try {
    const html = marked.parse(content) as string;
    // Sanitize HTML to prevent XSS attacks
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'code', 'pre',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel'],
    });
  } catch (error) {
    console.error('Markdown rendering error:', error);
    return escapeHtml(content);
  }
}

export function stripMarkdown(content: string): string {
  // Simple markdown stripping for previews
  return content
    .replace(/!\[.*?\]\(.*?\)/g, '') // Images
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // Code
    .replace(/#{1,6}\s/g, '') // Headers
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1') // Bold/italic
    .replace(/>\s/g, '') // Blockquotes
    .replace(/[-*+]\s/g, '') // Lists
    .trim();
}
