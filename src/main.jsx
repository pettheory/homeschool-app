/* main.jsx — entry point.
   The validated prototype loads plain-JS logic + JSX components that attach to
   `window` (window.PHON, window.ARC, window.Bolt, window.SetupScreen, …). We
   preserve that exact pattern: each module below runs for its side-effects and
   populates those globals, in the same order the prototype's <script> tags did.
   App reads them at render time, after every import has executed. */

// 1 · tolerance engine + content + engine profiles (plain JS, load first)
import './lib/phonetics.js';
import './lib/words.js';
import './lib/engine-profiles.js';
import './lib/voice.js'; // Bolt's voice: real ElevenLabs TTS (with browser fallback)
import './lib/judge.js'; // reading evaluation: real OpenAI/Gemini judge (with PHON fallback)

// 2 · arcade kit + screens (attach components to window)
import './screens/arcade-kit.jsx';
import './screens/setup-summary.jsx';
import './screens/voice-lab.jsx';
import './screens/hud-reading.jsx';
import './screens/spelling.jsx';

// 3 · app shell
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
