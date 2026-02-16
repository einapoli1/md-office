/**
 * Template engine supporting {{variable}}, {{#each}}...{{/each}}, {{#if}}...{{/if}}
 */

/** Extract all unique variable names from a template string */
export function extractVariables(template: string): string[] {
  const vars = new Set<string>();
  // Match {{variable}} but not {{#each}}, {{/each}}, {{#if}}, {{/if}}, {{else}}
  const re = /\{\{(?!#|\/|else\b)\s*([a-zA-Z_][\w.]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    vars.add(m[1]);
  }
  return Array.from(vars);
}

/** Resolve a dotted path like "address.city" in a data object */
function resolve(data: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((obj, key) => {
    if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

/** Render a template string with data */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  let result = template;

  // Process {{#each items}}...{{/each}}
  result = result.replace(
    /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_match, key: string, body: string) => {
      const arr = resolve(data, key);
      if (!Array.isArray(arr)) return '';
      return arr
        .map((item: unknown, index: number) => {
          const itemData: Record<string, unknown> =
            typeof item === 'object' && item !== null
              ? { ...data, ...(item as Record<string, unknown>), '@index': index }
              : { ...data, this: item, '@index': index };
          return renderTemplate(body, itemData);
        })
        .join('');
    }
  );

  // Process {{#if condition}}...{{else}}...{{/if}} and {{#if condition}}...{{/if}}
  result = result.replace(
    /\{\{#if\s+(\w[\w.]*)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, key: string, body: string) => {
      const val = resolve(data, key);
      const parts = body.split('{{else}}');
      const truthy = parts[0];
      const falsy = parts[1] || '';
      if (val && val !== '' && val !== 0 && !(Array.isArray(val) && val.length === 0)) {
        return renderTemplate(truthy, data);
      }
      return renderTemplate(falsy, data);
    }
  );

  // Replace {{variable}} with values
  result = result.replace(
    /\{\{(?!#|\/|else\b)\s*([a-zA-Z_][\w.]*)\s*\}\}/g,
    (_match, key: string) => {
      const val = resolve(data, key);
      return val !== undefined && val !== null ? String(val) : '';
    }
  );

  return result;
}

/** Parse CSV string into array of objects (first row = headers) */
export function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (values[i] || '').trim();
    });
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
