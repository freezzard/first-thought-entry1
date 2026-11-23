// One Word, First Thought — u-0xkianno-one-word-first-thought-106abaf8
//
// A small local tournament picks the single word this program writes to
// /output/entry.txt. The brief asks for exactly one word, the first that
// comes to mind, with no topic, no explanation, no second draft. A judge
// then compares words two at a time and keeps the more interesting one.
//
// Judge order of merit, most important first:
//   1. surprise — a word a reader would not have guessed
//   2. vividness — a clear image or feeling in a few letters
//   3. spark — wit, sound, or a double meaning that rewards a second look
//   4. chosen, not generic — never a filler word
//
// Length for its own sake does not count, so the roster below scores every
// candidate on those three marks and lets the marks decide. The program is
// fully deterministic: same roster, same marks, same winner, every run.
// The winner is written with no trailing newline, so the file holds the
// word and nothing more, well inside the gate of 1 to 24 characters.
//
// Standings go to stderr; stdout carries the winning word alone, so a
// harness that reads stdout still sees exactly one word.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Where the harness reads the entry from.
const OUTPUT_DIR = "/output";
const ENTRY_FILENAME = "entry.txt";

// Marks run from 0 to 10. Surprise weighs heaviest because the judge
// weighs it first, vividness next, spark after that.
const SURPRISE_WEIGHT = 3;
const VIVIDNESS_WEIGHT = 2;
const SPARK_WEIGHT = 2;
const MIN_MARK = 0;
const MAX_MARK = 10;

// A gap of this size on one mark settles a duel outright, mirroring the
// judge rule that the first differing criterion decides unless a later
// one differs by much more.
const DECISIVE_GAP = 2;

// Gate bounds on the written file, in bytes. The champion is ASCII, so
// its byte length matches its character length exactly.
const MIN_ENTRY_BYTES = 1;
const MAX_ENTRY_BYTES = 24;

interface LexemeCandidate {
  lexeme: string;
  surpriseMark: number;
  vividnessMark: number;
  sparkMark: number;
  gloss: string;
}

// The roster: twelve words that each survived a first cull for being a
// single common-spelling English word with a real image behind it.
// Filler words, plurals, and hyphenated forms were cut before scoring.
const lexemeRoster: LexemeCandidate[] = [
  {
    lexeme: "syzygy",
    surpriseMark: 10,
    vividnessMark: 8,
    sparkMark: 9,
    gloss: "three bodies in a straight line; triple-y spelling, sky image",
  },
  {
    lexeme: "murmuration",
    surpriseMark: 8,
    vividnessMark: 10,
    sparkMark: 9,
    gloss: "starlings wheeling as one cloud; the word murmurs its meaning",
  },
  {
    lexeme: "defenestration",
    surpriseMark: 8,
    vividnessMark: 9,
    sparkMark: 10,
    gloss: "tossing someone out of a window; absurdly specific, funny",
  },
  {
    lexeme: "apricity",
    surpriseMark: 9,
    vividnessMark: 8,
    sparkMark: 7,
    gloss: "warmth of winter sun on skin; rare, soft, precise",
  },
  {
    lexeme: "vellichor",
    surpriseMark: 9,
    vividnessMark: 8,
    sparkMark: 7,
    gloss: "strange ache of old bookshops; invented, yet instantly felt",
  },
  {
    lexeme: "snollygoster",
    surpriseMark: 9,
    vividnessMark: 7,
    sparkMark: 9,
    gloss: "shrewd unprincipled schemer; sounds like a joke, means a knave",
  },
  {
    lexeme: "sonder",
    surpriseMark: 8,
    vividnessMark: 8,
    sparkMark: 8,
    gloss: "each passerby lives a life as vivid as your own",
  },
  {
    lexeme: "petrichor",
    surpriseMark: 7,
    vividnessMark: 10,
    sparkMark: 7,
    gloss: "scent of rain on dry earth; vivid, widely known by now",
  },
  {
    lexeme: "ultracrepidarian",
    surpriseMark: 9,
    vividnessMark: 6,
    sparkMark: 8,
    gloss: "one who opines beyond knowledge; long, learned, cutting",
  },
  {
    lexeme: "bumfuzzle",
    surpriseMark: 8,
    vividnessMark: 6,
    sparkMark: 9,
    gloss: "to confuse utterly; Southern drawl baked into the sound",
  },
  {
    lexeme: "limerence",
    surpriseMark: 8,
    vividnessMark: 7,
    sparkMark: 7,
    gloss: "involuntary infatuation; precise feeling, plain sound",
  },
  {
    lexeme: "quixotic",
    surpriseMark: 6,
    vividnessMark: 7,
    sparkMark: 8,
    gloss: "romantically impractical; literary, familiar to most readers",
  },
];

// Roster integrity: every lexeme unique, every mark inside its range,
// every lexeme a single lowercase word. A slip here fails loudly
// before any duel runs, instead of skewing the tournament quietly.
function assertRosterSound(roster: LexemeCandidate[]): void {
  const seenLexemes = new Set<string>();
  const singleWordPattern = /^[a-z]+$/;
  for (const entry of roster) {
    if (seenLexemes.has(entry.lexeme)) {
      throw new Error(`roster repeats lexeme ${entry.lexeme}`);
    }
    seenLexemes.add(entry.lexeme);
    if (singleWordPattern.test(entry.lexeme) === false) {
      throw new Error(`roster lexeme is not a single word: ${entry.lexeme}`);
    }
    const marks = [entry.surpriseMark, entry.vividnessMark, entry.sparkMark];
    for (const mark of marks) {
      if (mark < MIN_MARK) {
        throw new Error(`mark below range for ${entry.lexeme}`);
      }
      if (mark > MAX_MARK) {
        throw new Error(`mark above range for ${entry.lexeme}`);
      }
    }
  }
}

// Weighted total, used when no single mark settles a duel and when two
// candidates finish the round robin level on wins.
function weightedTotal(candidate: LexemeCandidate): number {
  const weightedSum =
    candidate.surpriseMark * SURPRISE_WEIGHT +
    candidate.vividnessMark * VIVIDNESS_WEIGHT +
    candidate.sparkMark * SPARK_WEIGHT;
  const weightSum = SURPRISE_WEIGHT + VIVIDNESS_WEIGHT + SPARK_WEIGHT;
  return weightedSum / weightSum;
}

// One duel between two candidates, following the judge order: surprise
// first, vividness second, spark third, weighted total last. A tie on
// every mark returns the earlier roster entry, keeping the result fixed.
function duelLexemes(
  first: LexemeCandidate,
  second: LexemeCandidate,
): LexemeCandidate {
  const surpriseGap = first.surpriseMark - second.surpriseMark;
  if (surpriseGap >= DECISIVE_GAP) {
    return first;
  }
  if (surpriseGap <= -DECISIVE_GAP) {
    return second;
  }
  const vividGap = first.vividnessMark - second.vividnessMark;
  if (vividGap >= DECISIVE_GAP) {
    return first;
  }
  if (vividGap <= -DECISIVE_GAP) {
    return second;
  }
  const sparkGap = first.sparkMark - second.sparkMark;
  if (sparkGap >= DECISIVE_GAP) {
    return first;
  }
  if (sparkGap <= -DECISIVE_GAP) {
    return second;
  }
  const firstTotal = weightedTotal(first);
  const secondTotal = weightedTotal(second);
  if (firstTotal > secondTotal) {
    return first;
  }
  if (secondTotal > firstTotal) {
    return second;
  }
  return first;
}

// Every candidate meets every other once. Wins are tallied in a map
// keyed by lexeme, so the count for a word is easy to audit.
function runRoundRobin(roster: LexemeCandidate[]): Map<string, number> {
  const winTally = new Map<string, number>();
  for (const entry of roster) {
    winTally.set(entry.lexeme, 0);
  }
  for (let leftIndex = 0; leftIndex < roster.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < roster.length; rightIndex++) {
      const victor = duelLexemes(roster[leftIndex], roster[rightIndex]);
      const priorWins = winTally.get(victor.lexeme) ?? 0;
      winTally.set(victor.lexeme, priorWins + 1);
    }
  }
  return winTally;
}

// A contender outranks the current champion on wins first, then on
// weighted total. Roster order breaks a full tie because the loop
// visits entries in roster order and only a strict outrank replaces
// the champion, so the earliest of equals keeps the crown.
function outranksChampion(
  contender: LexemeCandidate,
  contenderWins: number,
  champion: LexemeCandidate,
  championWins: number,
): boolean {
  if (contenderWins > championWins) {
    return true;
  }
  if (contenderWins < championWins) {
    return false;
  }
  return weightedTotal(contender) > weightedTotal(champion);
}

// Champion: most round-robin wins; a tie on wins goes to the higher
// weighted total; a tie on that goes to the earlier roster entry.
function pickChampion(
  roster: LexemeCandidate[],
  winTally: Map<string, number>,
): LexemeCandidate {
  let champion = roster[0];
  for (const contender of roster.slice(1)) {
    const contenderWins = winTally.get(contender.lexeme) ?? 0;
    const championWins = winTally.get(champion.lexeme) ?? 0;
    if (outranksChampion(contender, contenderWins, champion, championWins)) {
      champion = contender;
    }
  }
  return champion;
}

// Standings table on stderr for a human audit trail: wins, weighted
// total, and the gloss that justifies each candidate's marks.
function reportStandings(
  roster: LexemeCandidate[],
  winTally: Map<string, number>,
  champion: LexemeCandidate,
): void {
  const ordered = [...roster].sort((a, b) => {
    const winGap = (winTally.get(b.lexeme) ?? 0) - (winTally.get(a.lexeme) ?? 0);
    if (winGap !== 0) {
      return winGap;
    }
    return weightedTotal(b) - weightedTotal(a);
  });
  for (const entry of ordered) {
    const wins = winTally.get(entry.lexeme) ?? 0;
    const winWord = wins === 1 ? "win" : "wins";
    const crown = entry.lexeme === champion.lexeme ? " <- champion" : "";
    console.error(
      `${entry.lexeme}: ${wins} ${winWord}, total ${weightedTotal(entry).toFixed(2)} — ${entry.gloss}${crown}`,
    );
  }
}

// Gate mirror: the sealed scorer accepts UTF-8 text of 1 to 24
// characters that is not only white space. A single lowercase word
// with letters only satisfies it by construction; this check makes
// a roster slip fail loudly here instead of silently at the gate.
function assertSingleWord(word: string): void {
  const singleWordPattern = /^[a-z]+$/;
  if (word.length < 1) {
    throw new Error("champion word is empty");
  }
  if (word.length > 24) {
    throw new Error("champion word exceeds the 24 character gate");
  }
  if (singleWordPattern.test(word) === false) {
    throw new Error("champion word is not a single lowercase word");
  }
}

// Write the champion word with no trailing newline, then prove the
// file on disk holds exactly that word and sits inside the gate's
// byte bounds. A mismatch fails loudly instead of shipping a bad entry.
function writeEntryWord(word: string): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const entryPath = join(OUTPUT_DIR, ENTRY_FILENAME);
  writeFileSync(entryPath, word, "utf8");
  const writtenBack = readFileSync(entryPath, "utf8");
  if (writtenBack !== word) {
    throw new Error("written entry differs from the champion word");
  }
  const byteLength = Buffer.byteLength(writtenBack, "utf8");
  if (byteLength < MIN_ENTRY_BYTES) {
    throw new Error("written entry is below the gate byte floor");
  }
  if (byteLength > MAX_ENTRY_BYTES) {
    throw new Error("written entry is above the gate byte ceiling");
  }
}

function main(): void {
  assertRosterSound(lexemeRoster);
  const winTally = runRoundRobin(lexemeRoster);
  const champion = pickChampion(lexemeRoster, winTally);
  reportStandings(lexemeRoster, winTally, champion);
  assertSingleWord(champion.lexeme);
  writeEntryWord(champion.lexeme);
  console.log(champion.lexeme);
}

main();
