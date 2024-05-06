import { parse } from "csv-parse/browser/esm/sync";
import * as v from "valibot";

import { TrashMap } from "../trash";
import type { SentenceType } from "./sentence";
import { SentenceSchema } from "./sentence";
import weightedRandom from "./weighted-random";

type GetSentencesReturnType =
  | [SentenceType[], Record<string, unknown> | undefined]
  | undefined;

export class StoryConfig {
  // prettier-ignore
  readonly firstSentenceExcludedWords: Set<string> = new Set([
    "aber", "also", "andererseits", "außerdem", "beide", "beiden", "beides", "dadurch", "daher", "damit", "danach", "daraufhin", "darum", "dementsprechend", "demnach", "demzufolge", "denn", "dennoch", "deshalb", "deswegen", "doch", "einerseits", "folglich", "hierdurch", "infolgedessen", "jedoch", "nichtsdestotrotz", "somit", "sondern", "sowohl", "stattdessen", "trotzdem", "weder", "zudem", "zwar", "nämlich", "obwohl", "weil", "wenn", "während", "währenddessen", "weshalb", "wie", "wieso", "wodurch", "wofür", "woher", "wohin", "womit", "woran", "worauf"
  ]);
}

export class Story {
  protected sentences: SentenceType[];
  private readonly config: StoryConfig;
  private trash: TrashMap;

  constructor({
    sentences,
    trashMap,
    config,
  }: {
    sentences: SentenceType[];
    trashMap?: TrashMap;
    config?: StoryConfig;
  }) {
    this.sentences = sentences;
    this.trash = trashMap || new TrashMap();

    // set config
    if (config instanceof StoryConfig) {
      this.config = config;
    } else {
      this.config = new StoryConfig();
    }
  }

  static parseSentences(data: unknown[]): SentenceType[] {
    const sentences: SentenceType[] = [];

    for (let i = 0; i < data.length; i++) {
      sentences.push(v.parse(SentenceSchema, data[i]));
    }

    return sentences;
  }

  static async loadSentencesFromCSV(
    csvUrl: URL | string
  ): Promise<SentenceType[]> {
    let data;

    // Check if code is running in Node.js
    if (typeof window === "undefined") {
      // In Node.js, use fs to read the file
      const fs = await import("node:fs");
      if (!fs || !fs.readFileSync) {
        throw new Error("fs module not available");
      }
      data = fs.readFileSync(csvUrl, "utf8");
    } else {
      // In the browser, use fetch to load the file
      const response = await fetch(csvUrl.toString());
      data = await response.text();
    }

    // parse text blob
    const records = parse(data, {
      columns: true,
      skip_empty_lines: true,
    });

    return Story.parseSentences(records);
  }

  private static *randomElementGenerator<T>(
    array: T[]
  ): Generator<T, void, void> {
    const arrayLength = array.length;
    const startIndex = Math.floor(Math.random() * arrayLength);
    let index = startIndex;
    do {
      yield array[index];
      index = (index + 1) % arrayLength;
    } while (index !== startIndex);
  }

  private pickRandomSentences(
    count: number,
    repeatedVerb?: string
  ): SentenceType[] | undefined {
    const result: SentenceType[] = [];
    const foundNouns: Set<string> = new Set();
    const foundVerbs: Set<string> = new Set();
    let foundAnd = false;

    for (const sent of Story.randomElementGenerator(this.sentences)) {
      // Check boolean flags

      // check "and"
      // "and" should only appear once
      if (foundAnd) {
        continue;
      }

      // No colon at the end allowed
      if (sent.endsWithColon) {
        continue;
      }

      // Check verbs
      if (repeatedVerb) {
        // must equal rootVerb
        if (sent.rootVerb !== repeatedVerb) {
          continue;
        }

        // Compare verbs, but exclude rootVerbLemma
        let foundDuplicateVerb = false;
        for (const verbLemma of sent.verbsLemma) {
          if (verbLemma === sent.rootVerbLemma) {
            continue;
          }

          if (foundVerbs.has(verbLemma)) {
            foundDuplicateVerb = true;
            break;
          }

          // check Verb trash
          if (
            this.trash.get("verbs")?.has(verbLemma) ||
            this.trash.get("repeatedVerbs")?.has(verbLemma)
          ) {
            foundDuplicateVerb = true;
            break;
          }
        }

        if (foundDuplicateVerb) {
          continue;
        }
      } else {
        // Compare verbs
        let foundDuplicateVerb = false;
        for (const verbLemma of sent.verbsLemma) {
          // Not the same verbs in the sentence
          if (foundVerbs.has(verbLemma)) {
            foundDuplicateVerb = true;
            break;
          }

          // check Verb trash
          if (
            this.trash.get("verbs")?.has(verbLemma) ||
            this.trash.get("repeatedVerbs")?.has(verbLemma)
          ) {
            foundDuplicateVerb = true;
            break;
          }
        }

        if (foundDuplicateVerb) {
          continue;
        }
      }

      // check nouns
      let foundDuplicateNoun = false;
      for (const nounLemma of sent.nounsLemma) {
        // Not the same nouns in the sentence
        if (foundNouns.has(nounLemma)) {
          foundDuplicateNoun = true;
          break;
        }

        // check Noun trash
        if (this.trash.get("nouns")?.has(nounLemma)) {
          foundDuplicateNoun = true;
          break;
        }
      }

      if (foundDuplicateNoun) {
        continue;
      }

      // check Source trash
      if (this.trash.get("sources")?.has(sent.source)) {
        continue;
      }

      // check Sentence trash
      if (this.trash.get("sentences")?.has(sent.id)) {
        continue;
      }

      // No single-word sentences
      if (sent.text.split(" ").length === 1) {
        continue;
      }

      // If it's the first sentence, exclude sentences with excluded words
      if (result.length === 0) {
        const words = sent.text.match(/\b\w+\b/g);
        if (
          words &&
          words.some((word) => this.config.firstSentenceExcludedWords.has(word))
        ) {
          continue;
        }
      }

      result.push(sent);
      sent.nounsLemma.forEach((n) => foundNouns.add(n));
      sent.verbsLemma.forEach((v) => foundVerbs.add(v));

      // check "and"
      if (sent.hasAnd) {
        foundAnd = true;
      }

      if (result.length === count) {
        break;
      }
    }

    return result.length > 0 ? result : undefined;
  }

  private pickRandomVerb(): string | undefined {
    for (const sent of Story.randomElementGenerator(this.sentences)) {
      if (
        !this.trash.get("repeatedVerbs")?.has(sent.rootVerbLemma) &&
        !this.trash.get("verbs")?.has(sent.rootVerbLemma)
      ) {
        return sent.rootVerb;
      }
    }
    return undefined;
  }

  static sortSentences(sentences: SentenceType[]): SentenceType[] {
    // Stelle Sätze ans Ende, die das Wort "und" enthalten.
    sentences.sort((sent1) => (sent1.hasAnd ? -1 : 1));

    // Sätze, die mit einem Doppelpunkt enden, müssen an den Anfang.
    // sentences.sort((sent1, sent2) => (sent1.endsWithColon ? -1 : 1));

    // Sätze, die einen Doppelpunkt beinhalten, aber mit ihm Enden,
    // müssen ans Ende.
    sentences.sort((sent1) => {
      if (sent1.text.includes(":") && !sent1.endsWithColon) {
        return 1;
      } else {
        return -1;
      }
    });

    return sentences;
  }

  private static getRandomSentCount(
    start: number,
    end: number,
    weights: number[]
  ): number {
    // Generiere eine zufällige Anzahl von Sätzen.
    // Manche Werte sollen häufiger vorkommen als andere.

    // Liste der möglichen Werte
    const values: number[] = Array.from(
      { length: end - start + 1 },
      (_, i) => start + i
    );

    // Zufällige Auswahl unter Berücksichtigung der Gewichte
    const result = weightedRandom(values, weights);

    return result;
  }

  private getEnumeratedSentences(): GetSentencesReturnType {
    /**
     * Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält.
     */
    const sentCount: number = Story.getRandomSentCount(
      1,
      8,
      [80, 10, 80, 100, 100, 50, 30, 10]
    );
    const sents: SentenceType[] | undefined =
      this.pickRandomSentences(sentCount);

    if (!sents) {
      return;
    }

    return [sents, undefined];
  }

  private getEnumeratedSentencesAndRepeatVerb(): GetSentencesReturnType {
    /**
     * Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält. Es wird ein Verb ausgewählt und nur Sätze mit diesem Verb werden ausgewählt.
     */

    // Generiere eine zufällige Anzahl von Sätzen.
    const sentCount: number = Story.getRandomSentCount(
      4,
      10,
      [100, 100, 100, 40, 10, 10, 5]
    );

    // Wähle ein Verb aus, das nicht im Trash liegt.
    // Das Verb wird über mehrere Sätze verwendet.
    const repeatedVerb: string | undefined = this.pickRandomVerb();
    const sents: SentenceType[] | undefined = this.pickRandomSentences(
      sentCount,
      repeatedVerb
    );

    if (!sents) {
      return;
    }

    return [sents, { repeatedVerb: repeatedVerb }];
  }

  private getSentences(): GetSentencesReturnType {
    // Liste der Funktionen
    const functions: (() => GetSentencesReturnType)[] = [
      this.getEnumeratedSentences.bind(this),
      this.getEnumeratedSentencesAndRepeatVerb.bind(this),
    ];

    // Gewichte für die Funktionen
    const weights: number[] = [100, 15];

    // Zufällige Auswahl unter Berücksichtigung der Gewichte
    const getSentencesFn: () => GetSentencesReturnType = weightedRandom(
      functions,
      weights
    );

    // Aufrufen der ausgewählten Funktion
    return getSentencesFn();
  }

  public generateText(times: number = 1): string[] {
    /**
     * Fängt an eine Geschichte zu erzählen.
     */
    const result: string[] = [];

    for (let n = 0; n < this.sentences.length; n++) {
      const getSentencesResult: GetSentencesReturnType = this.getSentences();

      if (!getSentencesResult) {
        continue;
      }

      const [sents, resultInfo] = getSentencesResult;

      if (!sents) {
        continue;
      }

      const sortedSents: SentenceType[] = Story.sortSentences(sents);

      if (!sortedSents) {
        continue;
      }

      const repeatedVerb: string | undefined =
        (resultInfo?.repeatedVerb as string) || undefined;

      // Speichere die Sätze im Trash
      for (const sent of sortedSents) {
        this.trash.get("sentences")?.add(sent.id);

        if (repeatedVerb) {
          this.trash.get("repeatedVerbs")?.add(repeatedVerb);
        }
        if (sent.verbsLemma.size) {
          this.trash.get("verbs")?.addMany(sent.verbsLemma);
        }
        if (sent.nounsLemma.size) {
          this.trash.get("nouns")?.addMany(sent.nounsLemma);
        }

        this.trash.get("sources")?.add(sent.source);
      }

      // Füge die Sätze zusammen
      const sentsLen: number = sortedSents.length;
      const textList: string[] = [];
      const lastIndex: number = sentsLen - 1;

      for (let i = 0; i < sentsLen; i++) {
        const sent: SentenceType = sortedSents[i];
        let text: string = sent.text;

        if (sentsLen > 1) {
          if (i === lastIndex) {
            text = ` und ${text}`;
          } else if (i !== 0) {
            text = `, ${text}`;
          }
        }

        textList.push(text);
      }

      // Satzanfang und Ende
      const text: string = `Der Körper ${textList.join("")}.`;

      // Füge den Text zur Liste hinzu
      result.push(text);

      if (result.length === times) {
        break;
      }
    }

    return result;
  }
}
export { SentenceSchema };
