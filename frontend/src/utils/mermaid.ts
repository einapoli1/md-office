import mermaid from 'mermaid';

// Initialize mermaid with configuration
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'inherit',
  darkMode: false,
});

// Update theme based on current mode
export const updateMermaidTheme = (isDark: boolean) => {
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit',
    darkMode: isDark,
    themeCSS: isDark ? `
      .node rect { fill: #2a2a2a; stroke: #555; }
      .node text { fill: #fff; }
      .edgeLabel { background-color: #2a2a2a; color: #fff; }
    ` : '',
  });
};

// Render a mermaid diagram
export const renderMermaidDiagram = async (code: string, element: HTMLElement): Promise<void> => {
  try {
    // Create a unique ID for this diagram
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate the diagram syntax
    const isValid = await mermaid.parse(code);
    if (!isValid) {
      throw new Error('Invalid Mermaid syntax');
    }

    // Render the diagram
    const { svg } = await mermaid.render(id, code);
    
    // Clear any existing content and add the SVG
    element.innerHTML = svg;
    element.setAttribute('data-processed', 'true');
  } catch (error) {
    console.error('Mermaid rendering error:', error);
    element.innerHTML = `
      <div style="
        padding: 16px; 
        border: 1px dashed #ff6b6b; 
        border-radius: 4px; 
        color: #ff6b6b;
        background: rgba(255, 107, 107, 0.1);
        font-family: monospace;
        font-size: 14px;
      ">
        Error rendering Mermaid diagram: ${error instanceof Error ? error.message : 'Unknown error'}
      </div>
    `;
    element.setAttribute('data-processed', 'true');
  }
};

// Process all unprocessed mermaid diagrams in a container
export const processMermaidDiagrams = (container: HTMLElement, isDark: boolean = false): void => {
  updateMermaidTheme(isDark);
  
  const diagrams = container.querySelectorAll('.mermaid-container[data-mermaid-code] .mermaid-rendered[data-processed="false"]');
  
  diagrams.forEach((element) => {
    const container = element.closest('.mermaid-container') as HTMLElement;
    const code = container?.getAttribute('data-mermaid-code');
    
    if (code && element instanceof HTMLElement) {
      renderMermaidDiagram(code, element);
    }
  });
};