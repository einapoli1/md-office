import { Plugin, PluginAPI } from '../lib/pluginSystem';

const PARAGRAPHS = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris.',
  'Praesent dapibus, neque id cursus faucibus, tortor neque egestas augue, eu vulputate magna eros eu erat. Aliquam erat volutpat. Nam dui mi, tincidunt quis, accumsan porttitor, facilisis luctus, metus.',
  'Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante. Donec eu libero sit amet quam egestas semper.',
];

function createLoremPlugin(): Plugin {
  let api: PluginAPI;

  return {
    id: 'lorem-ipsum',
    name: 'Lorem Ipsum',
    version: '1.0.0',
    author: 'MD Office',
    description: 'Insert 1-5 paragraphs of lorem ipsum placeholder text',

    activate(pluginApi) {
      api = pluginApi;
      api.registerSettings([
        { key: 'paragraphs', label: 'Number of paragraphs', type: 'number', default: 3 },
      ]);
      api.registerCommand('insert', 'Insert Lorem Ipsum', 'Insert', () => {
        const count = Math.max(1, Math.min(5, api.getSetting<number>('paragraphs') ?? 3));
        const text = PARAGRAPHS.slice(0, count).join('\n\n');
        api.insertText(text);
        api.showNotification(`Inserted ${count} paragraph(s) of lorem ipsum`, 'success');
      });
    },

    deactivate() {
      api.unregisterCommand('insert');
    },
  };
}

export default createLoremPlugin;
