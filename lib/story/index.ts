import * as v from "valibot";

import { randomFromRange, weightedRandom } from "../random";
import type { TrashMapConfig } from "../trash";
import { TrashMap } from "../trash";
import type { SentenceType } from "./sentence";
import { SentenceSchema } from "./sentence";
import { loadFile, parseCSVData } from "./utils";

export { SentenceSchema };

const FiltersSchema = v.object({
  // Anzahl der Sätze, die eine Iteration enthalten soll
  sentCount: v.optional(v.number([v.minValue(1)])),
  // Ein oder mehrere Verben, das in den Sätzen vorkommen sollen
  wantedWords: v.optional(v.array(v.string([v.minLength(1)]))),
  // Wörter, die nicht in den Sätzen vorkommen sollen
  // Wenn ein Satz eines dieser Wörter enthält, wird er nicht ausgewählt
  excludedWords: v.optional(v.array(v.string([v.minLength(1)]))),
});

const OptionsSchema = v.object({
  // Anzahl der Iterationen, wie oft generateText aufgerufen werden soll
  generateTextTimes: v.number([v.minValue(1)]),
  // Filter für die Generierung
  filters: v.optional(FiltersSchema),
  // Ob die exakte Anzahl von Sätzen erzwungen werden soll
  enforceExactSentCount: v.optional(v.boolean()),
});

const defaultOptions: Options = {
  generateTextTimes: 1,
  enforceExactSentCount: false,
};

const randomSentCountPattern = {
  start: 1, // Minimum number of sentences
  end: 5, // Maximum number of sentences
  weights: [100, 10, 100, 25, 25], // Weights for each number of sentences
};

export type Filters = v.Output<typeof FiltersSchema>;
export type Options = v.Output<typeof OptionsSchema>;

export type GenerateTextResult = {
  text: string;
  usedSentences: SentenceType[];
  repeatedVerb?: string;
};

export class StoryConfig {
  // prettier-ignore
  readonly firstSentenceExcludedWords: Set<string> = new Set([
    "aber", "also", "andererseits", "außerdem", "beide", "beiden", "beides", "dadurch", "daher", "damit", "danach", "daraufhin", "darum", "dementsprechend", "demnach", "demzufolge", "denn", "dennoch", "deshalb", "deswegen", "doch", "einerseits", "folglich", "hierdurch", "infolgedessen", "jedoch", "nichtsdestotrotz", "somit", "sondern", "sowohl", "stattdessen", "trotzdem", "weder", "zudem", "zwar", "nämlich", "obwohl", "weil", "wenn", "während", "währenddessen", "weshalb", "wie", "wieso", "wodurch", "wofür", "woher", "wohin", "womit", "woran", "worauf", "sonst", "sozusagen",
    "daraus", "aufgrund"
  ]);
}

export class Story {
  protected sentences: SentenceType[];
  protected usedSentences: SentenceType[] = [];
  private readonly config: StoryConfig;
  private trash: TrashMap;
  private filters: Filters = {};
  protected options: Options = defaultOptions;

  constructor({
    sentences,
    trashMap,
    config,
    options,
  }: {
    sentences: SentenceType[];
    trashMap?: TrashMap;
    trashConfig?: TrashMapConfig;
    config?: StoryConfig;
    options?: Options;
  }) {
    this.sentences = sentences;
    this.trash = trashMap || new TrashMap();

    // set config
    if (config instanceof StoryConfig) {
      this.config = config;
    } else {
      this.config = new StoryConfig();
    }

    this.updateOptions(options);
  }

  private parseOptions(options?: Options) {
    return v.parse(OptionsSchema, { ...defaultOptions, ...(options || {}) });
  }

  public updateOptions(options?: Options): void {
    this.options = this.parseOptions(options);
    const filters = this.getOption("filters");
    this.filters = filters
      ? v.parse(FiltersSchema, this.getOption("filters"))
      : {};
  }

  public getOptions(): Options {
    return this.options || {};
  }

  private getOption<T extends keyof Options>(key: T): Options[T] | undefined {
    return this.options?.[key];
  }

  private addFilter<T extends keyof Filters>(key: T, value: Filters[T]): void {
    this.filters[key] = value;
  }

  private getFilter<T extends keyof Filters>(key: T): Filters[T] | undefined {
    return this.filters?.[key];
  }

  private resetFilters(): void {
    this.filters = {};
  }

  public resetTrash(): void {
    this.trash.reset();
  }

  public updateTrashConfig(config: TrashMapConfig) {
    this.trash.updateConfig(config);
  }

  static async loadSentencesFromCSV(
    csvUrl: URL | string
  ): Promise<SentenceType[]> {
    const data = await loadFile(csvUrl);

    // parse text blob
    const records = (await parseCSVData(data)) as Record<string, unknown>[];

    // parse sentences
    const sentences = records.map((record) => Story.parseSentence(record));

    return sentences;
  }

  static async loadFrequenciesFromJSON(
    jsonUrl: URL | string
  ): Promise<Record<string, Record<string, number>>> {
    const data = await loadFile(jsonUrl);
    const frequencies: Record<string, Record<string, number>> = {};

    const records = JSON.parse(data);
    for (const [key, value] of Object.entries(records)) {
      frequencies[key] = value as Record<string, number>;
    }

    return frequencies;
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

  private checkNouns(sent: SentenceType, foundNouns: Set<string>): boolean {
    const wantedWords = this.getFilter("wantedWords");
    let foundDuplicateNoun = false;

    for (const nounData of sent.nounsParsed) {
      if (!nounData.lemma) {
        continue;
      }

      // Skip wanted words
      if (wantedWords && wantedWords.includes(nounData.word)) {
        continue;
      }

      // Not the same nouns in the sentence
      if (foundNouns.has(nounData.lemma)) {
        foundDuplicateNoun = true;
        break;
      }

      // check Noun trash
      if (this.trash.get("nouns")?.has(nounData.lemma)) {
        foundDuplicateNoun = true;
        break;
      }
    }

    if (foundDuplicateNoun) {
      return false;
    }

    return true;
  }

  private checkVerbs(sent: SentenceType, foundVerbs: Set<string>): boolean {
    // // Wenn das Verb nicht am Anfang des Satzes steht, wird der Satz ignoriert
    // if (!resultCount && !wantedVerbs.includes(sent.rootVerb)) {
    //   return false;
    // }
    const wantedWords = this.getFilter("wantedWords");
    let foundDuplicateVerb = false;

    for (const verbData of sent.verbsParsed) {
      if (!verbData.lemma) {
        continue;
      }

      // Skip wanted words
      if (wantedWords && wantedWords.includes(verbData.word)) {
        continue;
      }

      // Prüfe, ob das Verb bereits verwendet wurde
      if (foundVerbs.has(verbData.lemma)) {
        foundDuplicateVerb = true;
        break;
      }

      // check Verb trash
      if (this.trash.get("verbs")?.has(verbData.lemma)) {
        foundDuplicateVerb = true;
        break;
      }
    }

    if (foundDuplicateVerb) {
      return false;
    }

    return true;
  }

  private hasExcludedWords(sent: SentenceType): boolean {
    const excludedWords = this.getFilter("excludedWords");

    if (!excludedWords || excludedWords.length === 0) {
      return false;
    }

    // Prüfe, ob der Satz eines der ausgeschlossenen Wörter enthält
    const hasExcludedWord = sent.words.some((word) =>
      excludedWords.includes(word.toLowerCase())
    );

    return hasExcludedWord;
  }

  private hasWordsInRecentSentences(
    wantedWords: string[],
    n: number,
    sentences: SentenceType[]
  ): boolean {
    if (sentences.length < n) {
      return false;
    }

    for (let i = 0; i < n; i++) {
      const words = sentences[sentences.length - 1 - i].words;
      const foundWords = wantedWords.filter((word) => words.includes(word));

      if (foundWords.length) {
        return true;
      }
    }

    return false;
  }

  private checkWantedWordsInCurrentAndRecentSentences(
    sent: SentenceType,
    foundSentences: SentenceType[]
  ): boolean {
    const wantedWords = this.getFilter("wantedWords");

    if (!wantedWords) {
      return true;
    }

    // Check if any of the wanted words are in the current sentence
    const wantedWordsInSentence = sent.words.filter((word) =>
      wantedWords.includes(word)
    );

    if (!wantedWordsInSentence.length) {
      return false;
    }

    // Nur prüfen wenn mehr als ein gewünschtes Wort UND mehr als ein Satz erwartet wird
    const sentCount = this.getFilter("sentCount") || 1;
    if (wantedWords.length > 1 && sentCount > 1) {
      const wantedWordsCount = wantedWords.length;
      const sentenceCount = wantedWordsCount - 1;
      const usedSentences = this.usedSentences.concat(foundSentences || []);
      if (
        this.hasWordsInRecentSentences(
          wantedWordsInSentence,
          sentenceCount,
          usedSentences
        )
      ) {
        return false;
      }
    }

    return true;
  }

  private pickRandomSentences(): SentenceType[] {
    const result: SentenceType[] = [];
    const foundNouns: Set<string> = new Set();
    const foundVerbs: Set<string> = new Set();
    const foundSentences: SentenceType[] = [];
    const sentCount = this.getFilter("sentCount")!;
    const wantedWords = this.getFilter("wantedWords");
    const hasWantedWords = wantedWords && wantedWords.length > 0;
    const firstSentenceExcludedWords = this.config.firstSentenceExcludedWords;

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

      // Check wanted words if set
      if (hasWantedWords) {
        if (
          !this.checkWantedWordsInCurrentAndRecentSentences(
            sent,
            foundSentences
          )
        ) {
          continue;
        }
      }

      // Check nouns and verbs
      const nounCheck = this.checkNouns(sent, foundNouns);
      const verbCheck = this.checkVerbs(sent, foundVerbs);

      if (!nounCheck || !verbCheck) {
        continue;
      }

      // Check excluded words
      if (this.hasExcludedWords(sent)) {
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

      // First sentence cannot contain certain words
      if (
        result.length === 0 &&
        sent.words.some((word) =>
          firstSentenceExcludedWords.has(word.toLowerCase())
        )
      ) {
        continue;
      }

      result.push(sent);
      foundSentences.push(sent);
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

    return result;
  }

  public getRandomVerb(): string | undefined {
    for (const sent of this.randomElementGenerator(this.sentences)) {
      if (!this.trash.get("verbs")?.has(sent.rootVerbLemma)) {
        return sent.rootVerb;
      }
    }
  }

  static sortSentences(sentences: SentenceType[]): SentenceType[] {
    // Stelle Sätze ans Ende, die das Wort "und" enthalten.
    sentences.sort((sent1) => (sent1.hasAnd ? 1 : 0));

    // Sätze, die mit einem Doppelpunkt enden, müssen an den Anfang.
    // sentences.sort((sent1, sent2) => (sent1.endsWithColon ? -1 : 1));

    // Sätze, die einen Doppelpunkt beinhalten, aber nicht mit ihm Enden,
    // müssen ans Ende.
    sentences.sort((sent1) => {
      if (sent1.hasColon && !sent1.endsWithColon) {
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

  private setFiltersFromOptions(): void {
    this.resetFilters();

    const options = this.getOption("filters");
    const wantedFilters: Filters = {
      sentCount: undefined,
      wantedWords: undefined,
      excludedWords: undefined,
    };

    // Lege die Anzahl der Sätze fest, wenn sie nicht gesetzt ist
    if (options?.sentCount) {
      wantedFilters.sentCount = options.sentCount;
    } else {
      const sentCount = Story.getRandomSentCount(
        randomSentCountPattern.start,
        randomSentCountPattern.end,
        randomSentCountPattern.weights
      );
      // if (this.getFilter("mode") === "repeatVerb") {
      //   sentCount = Story.getRandomSentCount(4, 8, [100, 100, 100, 40, 10]);
      // }
      wantedFilters.sentCount = sentCount;
    }

    // Set wanted words filter and trash configs
    if (options?.wantedWords) {
      wantedFilters.wantedWords = options.wantedWords;
    }

    // Set excluded words filter
    if (options?.excludedWords) {
      wantedFilters.excludedWords = options.excludedWords;
    }

    // update filters
    this.addFilter("sentCount", wantedFilters.sentCount);
    this.addFilter("wantedWords", wantedFilters.wantedWords);
    this.addFilter("excludedWords", wantedFilters.excludedWords);
  }

  private generateTextOnce(): [string, SentenceType[]] | undefined {
    const sents = this.pickRandomSentences();
    const sortedSents: SentenceType[] = Story.sortSentences(sents);

    if (!sents || !sents.length) {
      return;
    }

    // Speichere die Sätze im Trash
    for (const sent of sortedSents) {
      this.trash.get("sentences")?.add(sent.id);

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

    return [text, sortedSents];
  }

  public generateText(): GenerateTextResult[] {
    /**
     * Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält.
     */
    const result: GenerateTextResult[] = [];
    const numberOfTimes = this.getOption("generateTextTimes") || 1;
    const expectedSentCount = this.getFilter("sentCount")!;
    const enforceExactSentCount =
      this.getOption("enforceExactSentCount") ?? false;

    for (let n = 0; n < numberOfTimes; n++) {
      // Bevor wir die Sätze auswählen, setzen wir die Filter
      this.setFiltersFromOptions();
      const [text, sentences] = this.generateTextOnce() || [];

      if (!text || !sentences) {
        // Keine passenden Sätze mehr verfügbar - Generator ist durch alle Sätze gegangen
        console.debug(
          `generateText() exhausted. Generated: ${result.length}/${numberOfTimes} texts.`
        );
        break;
      }

      if (enforceExactSentCount && sentences.length !== expectedSentCount) {
        continue;
      }

      result.push({
        text,
        usedSentences: sentences,
      });

      // Speichere den Verlauf der verwendeten Sätze
      this.usedSentences.push(...sentences);
    }

    return result;
  }
}
