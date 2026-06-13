/* words.js — lesson content. Each word carries what the tolerant UI needs:
   a picture-clue label (rendered as a placeholder), syllable breakdown and a
   "sound it out" hint for reading help, plus reading near-misses used by the
   demo controls. Spelling confusable/wrong captures are synthesised by
   phonetics.js so we don't hand-author them per word.
   Plain JS, attaches to window.WORDS. */
(function () {
  const LISTS = {
    starter: {
      id: 'starter', name: 'Tricky Everyday Words', level: 'Age 9–10 · mixed',
      words: [
        { word: 'butterfly', picture: 'a butterfly', syllables: ['but', 'ter', 'fly'],
          tip: 'Two T’s in the middle.', readClose: 'budderfly', readWrong: 'helicopter' },
        { word: 'because', picture: 'a question mark', syllables: ['be', 'cause'],
          tip: 'Big Elephants Can Always Understand Small Elephants.', readClose: 'becuz', readWrong: 'birthday' },
        { word: 'friend', picture: 'two friends', syllables: ['friend'],
          tip: 'A friend is there to the END.', readClose: 'frend', readWrong: 'frog' },
        { word: 'knight', picture: 'a knight in armour', syllables: ['knight'],
          tip: 'Silent K, and “igh” says “eye”.', readClose: 'night', readWrong: 'kitchen' },
        { word: 'island', picture: 'an island with a palm tree', syllables: ['is', 'land'],
          tip: 'There’s a silent S hiding inside.', readClose: 'iland', readWrong: 'elephant' },
        { word: 'ocean', picture: 'ocean waves', syllables: ['o', 'cean'],
          tip: 'The “c” makes a “sh” sound here.', readClose: 'oshun', readWrong: 'orange' },
        { word: 'beautiful', picture: 'a beautiful sunset', syllables: ['beau', 'ti', 'ful'],
          tip: 'Big Elephants Are Usually… “beau”.', readClose: 'bootiful', readWrong: 'dinosaur' },
        { word: 'rhythm', picture: 'a drum', syllables: ['rhy', 'thm'],
          tip: 'Rhythm Helps Your Two Hips Move.', readClose: 'rithum', readWrong: 'rocket' },
      ],
    },
    short: {
      id: 'short', name: 'Confidence Boosters', level: 'Age 9–10 · easier',
      words: [
        { word: 'jump', picture: 'a child jumping', syllables: ['jump'], tip: 'Sound each letter: j-u-m-p.', readClose: 'jumped', readWrong: 'zebra' },
        { word: 'green', picture: 'a green leaf', syllables: ['green'], tip: 'Double E says “ee”.', readClose: 'grean', readWrong: 'dragon' },
        { word: 'happy', picture: 'a smiling face', syllables: ['hap', 'py'], tip: 'Double P, then Y.', readClose: 'happi', readWrong: 'monkey' },
        { word: 'cloud', picture: 'a fluffy cloud', syllables: ['cloud'], tip: '“ou” says “ow”.', readClose: 'clowd', readWrong: 'planet' },
        { word: 'train', picture: 'a train', syllables: ['train'], tip: '“ai” says “ay”.', readClose: 'trane', readWrong: 'tiger' },
        { word: 'smile', picture: 'a big smile', syllables: ['smile'], tip: 'Magic E makes “i” say its name.', readClose: 'smiles', readWrong: 'dragon' },
      ],
    },
  };
  window.WORDS = {
    lists: LISTS,
    list: (id) => LISTS[id] || LISTS.starter,
    all: () => Object.values(LISTS),
  };
})();
