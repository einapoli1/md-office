// YAML frontmatter utilities for markdown styling metadata

export interface DocumentMetadata {
  title?: string;
  font?: 'Inter' | 'Lora' | 'Georgia' | 'Times' | 'Arial' | 'Helvetica';
  fontSize?: number;
  lineHeight?: number;
  pageMargins?: 'narrow' | 'normal' | 'wide';
  theme?: 'light' | 'dark';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  pageWidth?: 'narrow' | 'normal' | 'wide';
  pageSize?: 'letter' | 'a4' | 'legal' | 'tabloid';
  author?: string;
  date?: string;
  tags?: string[];
  [key: string]: any; // Allow additional custom fields
}

export interface ParsedDocument {
  metadata: DocumentMetadata;
  content: string;
  rawFrontmatter: string;
}

/**
 * Parse markdown with YAML frontmatter
 */
export function parseFrontmatter(markdown: string): ParsedDocument {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n(.*)$/s;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return {
      metadata: {},
      content: markdown.trim(),
      rawFrontmatter: ''
    };
  }

  const [, yamlContent, content] = match;
  
  try {
    const metadata = parseYAML(yamlContent);
    return {
      metadata,
      content: content.trim(),
      rawFrontmatter: yamlContent.trim()
    };
  } catch (error) {
    console.warn('Failed to parse YAML frontmatter:', error);
    return {
      metadata: {},
      content: markdown.trim(),
      rawFrontmatter: yamlContent.trim()
    };
  }
}

/**
 * Serialize document back to markdown with frontmatter
 */
export function serializeFrontmatter(metadata: DocumentMetadata, content: string): string {
  if (Object.keys(metadata).length === 0) {
    return content;
  }

  const yamlContent = serializeYAML(metadata);
  return `---\n${yamlContent}\n---\n\n${content}`;
}

/**
 * Simple YAML parser (subset) - handles common cases
 */
function parseYAML(yaml: string): DocumentMetadata {
  const result: DocumentMetadata = {};
  const lines = yaml.split('\n').map(line => line.trim()).filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('#')) continue; // Skip comments
    
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.substring(0, colonIndex).trim();
    const valueStr = line.substring(colonIndex + 1).trim();
    
    // Parse different value types
    let value: any = valueStr;
    
    // Remove quotes if present
    if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
        (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
      value = valueStr.slice(1, -1);
    }
    // Parse numbers
    else if (/^\d+(\.\d+)?$/.test(valueStr)) {
      value = parseFloat(valueStr);
    }
    // Parse booleans
    else if (valueStr === 'true') {
      value = true;
    }
    else if (valueStr === 'false') {
      value = false;
    }
    // Parse arrays (simple comma-separated)
    else if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
      const arrayContent = valueStr.slice(1, -1).trim();
      if (arrayContent) {
        value = arrayContent.split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
      } else {
        value = [];
      }
    }
    
    result[key] = value;
  }

  return result;
}

/**
 * Simple YAML serializer
 */
function serializeYAML(obj: DocumentMetadata): string {
  const lines: string[] = [];
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    
    if (typeof value === 'string') {
      // Quote strings that contain special characters
      const needsQuotes = /[#:{}[\]>|*&!%@`]/.test(value) || value !== value.trim();
      lines.push(`${key}: ${needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value}`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        const arrayStr = value.map(item => 
          typeof item === 'string' ? `"${item.replace(/"/g, '\\"')}"` : item
        ).join(', ');
        lines.push(`${key}: [${arrayStr}]`);
      }
    } else {
      // Fallback for other types
      lines.push(`${key}: "${String(value).replace(/"/g, '\\"')}"`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Get CSS styles from document metadata
 */
export function getDocumentStyles(metadata: DocumentMetadata): React.CSSProperties {
  const styles: React.CSSProperties = {};

  if (metadata.font) {
    const fontMap: Record<string, string> = {
      'Inter': 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'Lora': 'Lora, Georgia, serif',
      'Georgia': 'Georgia, serif',
      'Times': '"Times New Roman", Times, serif',
      'Arial': 'Arial, sans-serif',
      'Helvetica': '"Helvetica Neue", Helvetica, Arial, sans-serif'
    };
    styles.fontFamily = fontMap[metadata.font] || fontMap['Lora'];
  }

  if (metadata.fontSize) {
    styles.fontSize = `${metadata.fontSize}px`;
  }

  if (metadata.lineHeight) {
    styles.lineHeight = metadata.lineHeight;
  }

  if (metadata.textAlign) {
    styles.textAlign = metadata.textAlign;
  }

  return styles;
}

/**
 * Get page container styles from metadata
 */
export function getPageStyles(metadata: DocumentMetadata): {
  maxWidth: string;
  minHeight: string;
  padding: string;
} {
  // Page size dimensions (width x height in pixels at 96 DPI)
  const pageSizes = {
    letter: { width: '816px', height: '1056px' }, // 8.5" x 11"
    a4: { width: '794px', height: '1123px' },     // 8.27" x 11.69"
    legal: { width: '816px', height: '1344px' },  // 8.5" x 14"
    tabloid: { width: '1056px', height: '1632px' } // 11" x 17"
  };

  const pageSize = metadata.pageSize || 'letter';
  const selectedSize = pageSizes[pageSize] || pageSizes.letter;
  
  let maxWidth = selectedSize.width;
  let minHeight = selectedSize.height;
  let padding = '72px'; // Default 1 inch margins
  
  // Override with legacy pageWidth for backward compatibility
  if (metadata.pageWidth) {
    const widthMap = {
      'narrow': '672px', // 7" 
      'normal': '816px', // 8.5"
      'wide': '960px'    // 10"
    };
    maxWidth = widthMap[metadata.pageWidth] || maxWidth;
  }

  if (metadata.pageMargins) {
    const marginMap = {
      'narrow': '48px',  // 0.5 inch
      'normal': '72px',  // 1 inch (default)
      'wide': '96px'     // 1.33 inch
    };
    padding = marginMap[metadata.pageMargins] || padding;
  }

  return { maxWidth, minHeight, padding };
}

/**
 * Extract title from metadata or content
 */
export function extractTitle(metadata: DocumentMetadata, content: string): string {
  // First try metadata title
  if (metadata.title) {
    return metadata.title;
  }
  
  // Then try first H1 from content
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }
  
  // Fallback to first line of content
  const firstLine = content.split('\n')[0]?.trim();
  if (firstLine && firstLine.length < 100) {
    return firstLine;
  }
  
  return 'Untitled Document';
}

/**
 * Default metadata for new documents
 */
export function getDefaultMetadata(useLocalStoragePrefs: boolean = false): DocumentMetadata {
  const defaults: DocumentMetadata = {
    font: 'Lora',
    fontSize: 16,
    lineHeight: 1.6,
    pageMargins: 'normal',
    pageSize: 'letter',
    theme: 'light',
    textAlign: 'left'
  };

  // In guest mode, use localStorage preferences if available
  if (useLocalStoragePrefs) {
    const preferredPageSize = localStorage.getItem('preferredPageSize');
    const preferredPageMargins = localStorage.getItem('preferredPageMargins');
    
    if (preferredPageSize && ['letter', 'a4', 'legal', 'tabloid'].includes(preferredPageSize)) {
      defaults.pageSize = preferredPageSize as DocumentMetadata['pageSize'];
    }
    if (preferredPageMargins && ['narrow', 'normal', 'wide'].includes(preferredPageMargins)) {
      defaults.pageMargins = preferredPageMargins as DocumentMetadata['pageMargins'];
    }
  }

  return defaults;
}

/**
 * Update metadata with new values
 */
export function updateMetadata(
  currentMetadata: DocumentMetadata, 
  updates: Partial<DocumentMetadata>
): DocumentMetadata {
  return { ...currentMetadata, ...updates };
}