# NATO phonetic alphabet for spelling letters

- **Slug:** nato-phonetic-letters
- **Status:** done   <!-- draft → ready → building → done -->
- **Owner:** dnichol

## Problem / why
Kids and parents disambiguate mis-heard letters by spelling words out ("B for ball"). The
tolerance engine already understands the "<letter> for <word>" trick and spoken letter-names
("bee", "see"), but not the NATO phonetic alphabet ("alpha, bravo, charlie") — a common,
unambiguous way to say letters that would further cut mic confusion during spelling.

## Outcome
When the child (or the synthetic-speaker harness) says NATO words while spelling, each maps to
its letter: "alpha bravo charlie" → A, B, C.

## Scope
- **In:** recognise the 26 NATO words in `spokenToLetter` / `parseLetters` (`src/lib/phonetics.js`).
- **Out:** UI copy/coaching changes; reading mode; non-English alphabets.

## Approach
Add a NATO word→letter map alongside `WORD_TO_LETTER` in `src/lib/phonetics.js` and consult it
in `spokenToLetter`. Preserve all existing behaviour (single letters, letter-names, the
"<letter> for <word>" pattern). Reuse the existing `parseLetters` pipeline unchanged.

## Acceptance criteria (verifiable)
- [ ] `test/phonetics.test.js` covers: `PHON.parseLetters('alpha bravo charlie')` → `['A','B','C']`
      and `PHON.spokenToLetter('zulu')` → `'Z'`.
- [ ] All existing phonetics tests still pass; `npm run build` passes.
- [ ] Mixed input still works: `PHON.parseLetters('B for ball, charlie, dee')` → `['B','C','D']`.

## Notes / open questions
None — small and self-contained.
