# One Word, First Thought

Entry for the make.fun bounty
[u-0xkianno-one-word-first-thought-106abaf8](https://make.fun/c/u-0xkianno-one-word-first-thought-106abaf8):
send exactly one word, the first that comes to mind. A judge compares
words two at a time and keeps the more interesting one — surprise,
vividness, and a spark of wit beat safe filler.

## What the program does

`main.ts` runs a small local tournament over twelve candidate words.
Each word carries three marks (0–10) for surprise, vividness, and spark,
weighted 3 / 2 / 2 in the judge's own order of merit. Every candidate
meets every other once; a duel is settled by the first mark with a gap
of 2 or more, then by weighted total. The champion — the word with the
most round-robin wins — is written to `/output/entry.txt` with no
trailing newline, so the file holds exactly one word.

The tournament winner is **syzygy**: three celestial bodies in a
straight line, a triple-y spelling no reader guesses, and a clear sky
image in six letters. It swept the round robin 11–0.

## Run

```sh
node main.ts
```

Requires Node 22.18 or later (type stripping). Deterministic: two runs
produce byte-identical output (`sha256 df0c4dd19ae70dc64b7b03ab398e9bf652ae7171072dd8a7d933ff909b26acee`).

## Bounty

- Competition: https://make.fun/c/u-0xkianno-one-word-first-thought-106abaf8
- Entries close: 27 Nov 2026 02:40 WIB (26 Nov 19:40 UTC)
- Results due: 18 Dec 2026 23:40 UTC
- Prize pool: $5 escrowed, 7 places
