/**
 * Converts description HTML extracted from the active LeetCode page to Markdown.
 * No LLM is called and no information beyond the source description is added.
 */
function stripHtml(html) {
  return html
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => `\n\`\`\`\n${code.replace(/<[^>]+>/g, '')}\n\`\`\`\n`)
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatDescriptionDeterministic({ problemTitle, problemDescription }) {
  const content = stripHtml(problemDescription || '');
  if (!content) throw new Error('The LeetCode problem description is empty. No GitHub changes were made.');
  return `# ${problemTitle}\n\n## Problem Description\n\n${content}\n`;
}

export async function generateDescription(problemData) {
  return { content: formatDescriptionDeterministic(problemData), source: 'leetcode' };
}
