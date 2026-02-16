import { Plugin, PluginAPI } from '../lib/pluginSystem';

const KEYWORDS: Record<string, string[]> = {
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'default', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof'],
  python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'try', 'except', 'raise', 'with', 'lambda', 'yield', 'pass', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is'],
  css: ['color', 'background', 'display', 'flex', 'grid', 'margin', 'padding', 'border', 'font-size', 'position', 'width', 'height', 'z-index', 'opacity', 'transition', 'transform', 'animation', 'overflow', 'important'],
};

function createCodeHighlightPlugin(): Plugin {
  let api: PluginAPI;

  return {
    id: 'code-highlight',
    name: 'Code Highlight',
    version: '1.0.0',
    author: 'MD Office',
    description: 'Syntax keyword reference for JS, Python, and CSS code blocks',

    activate(pluginApi) {
      api = pluginApi;
      api.registerCommand('show-keywords', 'Show Syntax Keywords', 'Tools', () => {
        const lang = api.getSetting<string>('language') ?? 'javascript';
        const words = KEYWORDS[lang] ?? [];
        api.showNotification(`${lang} keywords: ${words.join(', ')}`, 'info');
      });
      api.registerSettings([
        {
          key: 'language',
          label: 'Language',
          type: 'select',
          default: 'javascript',
          options: [
            { label: 'JavaScript', value: 'javascript' },
            { label: 'Python', value: 'python' },
            { label: 'CSS', value: 'css' },
          ],
        },
      ]);
      api.registerSidebarPanel('💻', 'Syntax Keywords', () => {
        const lang = api.getSetting<string>('language') ?? 'javascript';
        const words = KEYWORDS[lang] ?? [];
        return `<div><h4>${lang}</h4><p>${words.map(w => `<code>${w}</code>`).join(' ')}</p></div>`;
      });
    },

    deactivate() {
      api.unregisterCommand('show-keywords');
      api.unregisterSidebarPanel('Syntax Keywords');
    },
  };
}

export default createCodeHighlightPlugin;
