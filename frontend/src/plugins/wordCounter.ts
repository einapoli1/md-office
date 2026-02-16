import { Plugin, PluginAPI } from '../lib/pluginSystem';

function createWordCounterPlugin(): Plugin {
  let api: PluginAPI;
  let interval: ReturnType<typeof setInterval> | null = null;
  const dailyStats: Record<string, number> = {};

  function today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function countWords(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  function update() {
    const content = api.getContent();
    const words = countWords(content);
    const goal = api.getSetting<number>('dailyGoal') ?? 500;
    const key = today();
    if (!dailyStats[key]) dailyStats[key] = 0;
    dailyStats[key] = words;
    const pct = Math.min(100, Math.round((words / goal) * 100));
    api.updateStatusBarItem('wordcount', `✏️ ${words} words (${pct}% of ${goal})`, `Daily goal: ${goal} words`);
  }

  return {
    id: 'word-counter',
    name: 'Word Counter',
    version: '1.0.0',
    author: 'MD Office',
    description: 'Live word count goal tracker with daily writing statistics',

    activate(pluginApi) {
      api = pluginApi;
      api.registerSettings([
        { key: 'dailyGoal', label: 'Daily word goal', type: 'number', default: 500 },
      ]);
      api.registerStatusBarItem('wordcount', '✏️ 0 words', 'right', 'Word count');
      api.on('onContentChange', update);
      interval = setInterval(update, 5000);
      update();
    },

    deactivate() {
      if (interval) clearInterval(interval);
      api.off('onContentChange', update);
      api.unregisterStatusBarItem('wordcount');
    },
  };
}

export default createWordCounterPlugin;
