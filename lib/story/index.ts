import { parse } from "csv-parse/browser/esm/sync";
import * as v from "valibot";

import { randomFromRange, weightedRandom } from "../random";
import { TrashMap } from "../trash";
import type { SentenceType } from "./sentence";
import { SentenceSchema } from "./sentence";

export { SentenceSchema };

const FiltersSchema = v.object({
  // Modus der Textgenerierung
  mode: v.optional(v.picklist(["normal", "repeatVerb"])),
  // Anzahl der Sätze, die eine Iteration enthalten soll
  sentCount: v.optional(v.number([v.minValue(1)])),
  // Ein Verb, das in den Sätzen vorkommen soll
  verb: v.optional(v.string()),
  // Position des Verbs im Satz
  verbPos: v.optional(v.picklist(["start"])),
});

export type Filters = v.Output<typeof FiltersSchema>;

export type TextGenerationResult = {
  text: string;
  usedSentences: SentenceType[];
  repeatedVerb?: string;
};

export class StoryConfig {
  // prettier-ignore
  readonly firstSentenceExcludedWords: Set<string> = new Set([
    "aber", "also", "andererseits", "außerdem", "beide", "beiden", "beides", "dadurch", "daher", "damit", "danach", "daraufhin", "darum", "dementsprechend", "demnach", "demzufolge", "denn", "dennoch", "deshalb", "deswegen", "doch", "einerseits", "folglich", "hierdurch", "infolgedessen", "jedoch", "nichtsdestotrotz", "somit", "sondern", "sowohl", "stattdessen", "trotzdem", "weder", "zudem", "zwar", "nämlich", "obwohl", "weil", "wenn", "während", "währenddessen", "weshalb", "wie", "wieso", "wodurch", "wofür", "woher", "wohin", "womit", "woran", "worauf", "sonst", "sozusagen",
  ]);
}

export class Story {
  protected sentences: SentenceType[];
  private readonly config: StoryConfig;
  private trash: TrashMap;
  private filters?: Filters;

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

  private setFilters(filters: Filters): void {
    this.filters = filters;
  }

  private clearFilters(): void {
    this.filters = undefined;
  }

  private addFilter<T extends keyof Filters>(key: T, value: Filters[T]): void {
    if (!this.filters) {
      this.filters = {};
    }

    this.filters[key] = value;
  }

  private getFilter<T extends keyof Filters>(key: T): Filters[T] | undefined {
    return this.filters?.[key];
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

    const sentences = records.map((record: Record<string, unknown>) =>
      Story.parseSentence(record)
    );

    return sentences;
  }

  static parseSentence(data: Record<string, unknown>): SentenceType {
    return v.parse(SentenceSchema, data);
  }

  private *randomElementGenerator<T>(array: T[]): Generator<T, void, void> {
    const indices = [...Array(array.length).keys()];
    let remaining = array.length;

    while (remaining > 0) {
      const randomIndex = randomFromRange(0, remaining - 1);
      // const randomIndex = Math.floor(Math.random() * remaining);
      yield array[indices[randomIndex]];
      indices[randomIndex] = indices[remaining - 1];
      remaining--;
    }
  }

  private checkVerbs(
    sent: SentenceType,
    resultCount: number,
    foundVerbs: Set<string>
  ): boolean {
    const wantedVerb = this.getFilter("verb");
    const mode = this.getFilter("mode");
    const verbPos = this.getFilter("verbPos");
    let foundDuplicateVerb = false;
    let exludedLemma;

    switch (mode) {
      case "repeatVerb":
        if (sent.rootVerb !== wantedVerb) {
          return false;
        }
        exludedLemma = sent.rootVerbLemma;
        break;
      case "normal":
        if (verbPos === "start" && wantedVerb) {
          if (!resultCount && sent.rootVerb !== wantedVerb) {
            return false;
          }
          const verbIndex = Array.from(sent.verbs).findIndex(
            (v) => v === wantedVerb
          );
          exludedLemma = Array.from(sent.verbsLemma)[verbIndex];
        }
        break;
      default:
        throw new Error("Invalid mode");
    }

    // Prüfe, ob das Verb bereits verwendet wurde
    for (const verbLemma of sent.verbsLemma) {
      if (exludedLemma && verbLemma === exludedLemma) {
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
      return false;
    }

    return true;
  }

  private checkNouns(sent: SentenceType, foundNouns: Set<string>): boolean {
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
      return false;
    }

    return true;
  }

  private pickRandomSentences(): SentenceType[] | undefined {
    const result: SentenceType[] = [];
    const foundNouns: Set<string> = new Set();
    const foundVerbs: Set<string> = new Set();

    const sentCount = this.filters!.sentCount;

    let foundAnd = false;

    for (const sent of this.randomElementGenerator(this.sentences)) {
      // Check boolean flags

      // "and" should only appear once
      if (foundAnd) {
        continue;
      }

      // No colon at the end allowed
      if (sent.endsWithColon) {
        continue;
      }

      // Check verbs
      if (!this.checkVerbs(sent, result.length, foundVerbs)) {
        continue;
      }

      // check nouns
      if (!this.checkNouns(sent, foundNouns)) {
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
      if (
        result.length === 0 &&
        sent.tokens.some((token) =>
          this.config.firstSentenceExcludedWords.has(token)
        )
      ) {
        continue;
      }

      result.push(sent);
      sent.nounsLemma.forEach((n) => foundNouns.add(n));
      sent.verbsLemma.forEach((v) => foundVerbs.add(v));

      // check "and"
      if (sent.hasAnd) {
        foundAnd = true;
      }

      if (result.length === sentCount) {
        break;
      }
    }

    return result.length > 0 ? result : undefined;
  }

  private pickRandomVerb(): string | undefined {
    for (const sent of this.randomElementGenerator(this.sentences)) {
      if (
        !this.trash.get("repeatedVerbs")?.has(sent.rootVerbLemma) &&
        !this.trash.get("verbs")?.has(sent.rootVerbLemma)
      ) {
        return sent.rootVerb;
      }
    }
  }

  static sortSentences(sentences: SentenceType[]): SentenceType[] {
    // Stelle Sätze ans Ende, die das Wort "und" enthalten.
    sentences.sort((sent1) => (sent1.hasAnd ? 1 : 0));

    // Sätze, die mit einem Doppelpunkt enden, müssen an den Anfang.
    // sentences.sort((sent1, sent2) => (sent1.endsWithColon ? -1 : 1));

    // Sätze, die einen Doppelpunkt beinhalten, aber mit ihm Enden,
    // müssen ans Ende.
    sentences.sort((sent1) => {
      if (sent1.text.includes(":") && !sent1.endsWithColon) {
        return 1;
      } else {
        return 0;
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

  private createFilters(filters?: Filters): void {
    // Setze Filter, die einen Wert benötigen

    const modes: Required<Filters>["mode"][] = [
      // Modus: normal
      // Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält.
      "normal",

      // Modus: repeatVerb
      // Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält. Es wird ein Verb ausgewählt und nur Sätze mit diesem Verb werden ausgewählt.
      "repeatVerb",
    ];

    this.clearFilters();

    if (filters) {
      const validFilters = v.parse(FiltersSchema, filters);
      this.setFilters(validFilters);
    }

    // Wähle den Modus zufällig aus, wenn er nicht gesetzt ist
    if (!this.getFilter("mode")) {
      const modeIndices = modes.map((_, i) => i);
      const weights = [100, 15];
      const mode = weightedRandom(modeIndices, weights);
      this.addFilter("mode", mode === 0 ? "normal" : "repeatVerb");
    }

    // Lege die Anzahl der Sätze fest, wenn sie nicht gesetzt ist
    if (!this.getFilter("sentCount")) {
      let sentCount;
      if (this.getFilter("mode") === "normal") {
        sentCount = Story.getRandomSentCount(
          1,
          7,
          [100, 10, 100, 100, 50, 40, 10]
        );
      } else if (this.getFilter("mode") === "repeatVerb") {
        sentCount = Story.getRandomSentCount(4, 8, [100, 100, 100, 40, 10]);
      }
      this.addFilter("sentCount", sentCount);
    }

    // Setze sich wiederholendes Verb, wenn der Modus "repeatVerb" ist und das Verb nicht gesetzt ist
    if (this.getFilter("mode") === "repeatVerb" && !this.getFilter("verb")) {
      const verb = this.pickRandomVerb();
      if (verb) {
        this.addFilter("verb", verb);
      }
    }
  }

  public generateText(times = 1, filters?: Filters): TextGenerationResult[] {
    /**
     * Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält.
     */
    const result: TextGenerationResult[] = [];
    const isRepeatedVerbMode = this.getFilter("mode") === "repeatVerb";

    for (let n = 0; n < this.sentences.length; n++) {
      this.createFilters(filters);
      const sents = this.pickRandomSentences();

      if (!sents) {
        continue;
      }

      const sortedSents: SentenceType[] = Story.sortSentences(sents);

      if (!sortedSents) {
        continue;
      }

      // Speichere die Sätze im Trash
      for (const sent of sortedSents) {
        this.trash.get("sentences")?.add(sent.id);

        if (isRepeatedVerbMode) {
          this.trash.get("repeatedVerbs")?.add(this.getFilter("verb")!);
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
      const toBeJoinedTexts: string[] = [];
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

        toBeJoinedTexts.push(text);
      }

      // Satzanfang und Ende
      const text: string = `Der Körper ${toBeJoinedTexts.join("")}.`;

      // Füge den Text zur Liste hinzu
      result.push({
        text,
        repeatedVerb: this.getFilter("verb"),
        usedSentences: sortedSents,
      });

      if (result.length === times) {
        break;
      }
    }

    return result;
  }
}
