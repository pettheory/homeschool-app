import { defineConfig } from 'vitest/config';

// phonetics.js is plain JS that attaches window.PHON, so tests run in a DOM env.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.js'],
  },
});
