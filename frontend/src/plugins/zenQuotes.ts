import { Plugin, PluginAPI } from '../lib/pluginSystem';

const QUOTES = [
  '"Start writing, no matter what. The water does not flow until the faucet is turned on." — Louis L\'Amour',
  '"You can always edit a bad page. You can\'t edit a blank page." — Jodi Picoult',
  '"The first draft is just you telling yourself the story." — Terry Pratchett',
  '"Write hard and clear about what hurts." — Ernest Hemingway',
  '"If you want to be a writer, you must do two things: read a lot and write a lot." — Stephen King',
  '"There is no greater agony than bearing an untold story inside you." — Maya Angelou',
  '"You don\'t start out writing good stuff. You start out writing crap." — Octavia Butler',
  '"Almost all good writing begins with terrible first efforts." — Anne Lamott',
  '"The scariest moment is always just before you start." — Stephen King',
  '"Fill your paper with the breathings of your heart." — William Wordsworth',
];

function createZenQuotesPlugin(): Plugin {
  let api: PluginAPI;
  let interval: ReturnType<typeof setInterval> | null = null;

  function randomQuote() {
    return QUOTES[Math.floor(Math.random() * QUOTES.length)];
  }

  function update() {
    api.updateStatusBarItem('zen', `💡 ${randomQuote()}`);
  }

  return {
    id: 'zen-quotes',
    name: 'Zen Quotes',
    version: '1.0.0',
    author: 'MD Office',
    description: 'Inspirational writing quotes in the status bar, rotating every 30 minutes',

    activate(pluginApi) {
      api = pluginApi;
      api.registerStatusBarItem('zen', `💡 ${randomQuote()}`, 'left', 'Writing inspiration');
      interval = setInterval(update, 30 * 60 * 1000);
    },

    deactivate() {
      if (interval) clearInterval(interval);
      api.unregisterStatusBarItem('zen');
    },
  };
}

export default createZenQuotesPlugin;
