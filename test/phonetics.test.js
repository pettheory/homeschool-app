import { describe, it, expect } from 'vitest';

// phonetics.js is an IIFE that attaches window.PHON (no exports) — import for side-effects.
import '../src/lib/phonetics.js';

const PHON = window.PHON;

describe('tolerance engine — letter confusion', () => {
  it('treats same-sound letters as confusable (B/P, B/D)', () => {
    expect(PHON.confusable('B', 'P')).toBe(true);
    expect(PHON.confusable('b', 'd')).toBe(true);
  });
  it('treats clearly different letters as NOT confusable (B/A, T/X)', () => {
    expect(PHON.confusable('B', 'A')).toBe(false);
    expect(PHON.confusable('T', 'X')).toBe(false);
  });
  it('lists confusion partners', () => {
    expect(PHON.partners('B')).toEqual(expect.arrayContaining(['P', 'D', 'E']));
  });
});

describe('tolerance engine — parseLetters', () => {
  it('parses spoken letters, words, and the "X for word" trick', () => {
    expect(PHON.parseLetters('B for ball, U, T')).toEqual(['B', 'U', 'T']);
    expect(PHON.parseLetters('double u, eye, ess')).toEqual(['W', 'I', 'S']);
  });
});

describe('tolerance engine — NATO phonetic alphabet', () => {
  it('parses a NATO word sequence into letters', () => {
    expect(PHON.parseLetters('alpha bravo charlie')).toEqual(['A', 'B', 'C']);
  });
  it('maps a single NATO word to its letter', () => {
    expect(PHON.spokenToLetter('zulu')).toBe('Z');
  });
  it('covers all 26 NATO words', () => {
    const words = [
      'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
      'india', 'juliett', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
      'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey',
      'x-ray', 'yankee', 'zulu',
    ];
    expect(words.map((w) => PHON.spokenToLetter(w)).join('')).toBe(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    );
  });
  it('mixes NATO words with letter-names and the "X for word" trick', () => {
    expect(PHON.parseLetters('B for ball, charlie, dee')).toEqual(['B', 'C', 'D']);
  });
});

describe('tolerance engine — evalReading', () => {
  it('exact and homophone read as correct', () => {
    expect(PHON.evalReading('cat', 'cat').verdict).toBe('correct');
    expect(PHON.evalReading('night', 'knight').verdict).toBe('correct');
  });
  it('silence / empty is unclear (never penalised)', () => {
    expect(PHON.evalReading('cat', '').verdict).toBe('unclear');
  });
  it('a plural/ending slip still counts as close', () => {
    expect(PHON.evalReading('cats', 'cat').verdict).toBe('close');
  });
  it('a clearly different word is incorrect', () => {
    expect(PHON.evalReading('cat', 'elephant').verdict).toBe('incorrect');
  });
});

describe('tolerance engine — evalSpelling', () => {
  it('exact letters are correct', () => {
    expect(PHON.evalSpelling('cat', ['C', 'A', 'T']).verdict).toBe('correct');
  });
  it('only sound-alike slips → confirm (benefit of the doubt)', () => {
    // T and D are both in the "ee" confusion set
    expect(PHON.evalSpelling('cat', ['C', 'A', 'D']).verdict).toBe('confirm');
  });
  it('a genuine wrong letter → incorrect', () => {
    // X is not confusable with T
    expect(PHON.evalSpelling('cat', ['C', 'A', 'X']).verdict).toBe('incorrect');
  });
  it('an empty attempt → incorrect', () => {
    expect(PHON.evalSpelling('cat', []).verdict).toBe('incorrect');
  });
});
