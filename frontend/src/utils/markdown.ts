// Simple markdown to HTML converter for preview
export const markdownToHtml = (markdown: string): string => {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\_\_(.*)\__/gim, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*)\*/gim, '<em>$1</em>');
  html = html.replace(/\_(.*)\__/gim, '<em>$1</em>');

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
  
  // Inline code
  html = html.replace(/`(.*?)`/gim, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]*)\]\(([^\)]*)\)/gim, '<a href="$2">$1</a>');

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Unordered lists
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

  // Paragraphs
  html = html.replace(/^\s*(.+)$/gim, '<p>$1</p>');

  // Clean up
  html = html.replace(/<\/p>\s*<p>/gim, '</p><p>');
  html = html.replace(/<p><h([1-6])>/gim, '<h$1>');
  html = html.replace(/<\/h([1-6])><\/p>/gim, '</h$1>');
  html = html.replace(/<p><ul>/gim, '<ul>');
  html = html.replace(/<\/ul><\/p>/gim, '</ul>');
  html = html.replace(/<p><blockquote>/gim, '<blockquote>');
  html = html.replace(/<\/blockquote><\/p>/gim, '</blockquote>');

  return html;
};