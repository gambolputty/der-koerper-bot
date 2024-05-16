import * as v from "valibot";

import { randomFromRange, weightedRandom } from "../random";
import { TrashMap } from "../trash";
import type { SentenceType } from "./sentence";
import { SentenceSchema } from "./sentence";
import { loadFile, parseCSVData } from "./utils";

export { SentenceSchema };

const FiltersSchema = v.object({
  // Anzahl der Sätze, die eine Iteration enthalten soll
  sentCount: v.optional(v.number([v.minValue(1)])),
  // Ein oder mehrere Verben, das in den Sätzen vorkommen sollen
  verbs: v.optional(v.array(v.string([v.minLength(1)]))),
  // Ein oder mehrere Nomen, das in den Sätzen vorkommen sollen
  nouns: v.optional(v.array(v.string([v.minLength(1)]))),
});

export type Filters = v.Output<typeof FiltersSchema>;

export type GenerateTextProps = {
  times?: number;
  filters?: Filters;
};

export type GenerateTextResult = {
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
  protected sentencesUsed: SentenceType[] = [];
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
    let foundDuplicateNoun = false;
    const wantedNouns = this.getFilter("nouns");

    for (const nounData of sent.nounsParsed) {
      if (wantedNouns && wantedNouns.includes(nounData.noun)) {
        continue;
      }

      // Not the same nouns in the sentence
      if (nounData.lemma && foundNouns.has(nounData.lemma)) {
        foundDuplicateNoun = true;
        break;
      }

      // check Noun trash
      if (
        (nounData.lemma && this.trash.get("nouns")?.has(nounData.lemma)) ||
        (nounData.lemma && this.trash.get("repeatedNouns")?.has(nounData.lemma))
      ) {
        foundDuplicateNoun = true;
        break;
      }
    }

    if (foundDuplicateNoun) {
      return false;
    }

    return true;
  }

  private checkVerbs(
    sent: SentenceType,
    resultCount: number,
    foundVerbs: Set<string>
  ): boolean {
    const wantedVerbs = this.getFilter("verbs");
    let foundDuplicateVerb = false;

    // // Wenn das Verb nicht am Anfang des Satzes steht, wird der Satz ignoriert
    // if (!resultCount && !wantedVerbs.includes(sent.rootVerb)) {
    //   return false;
    // }

    for (const verbData of sent.verbsParsed) {
      if (wantedVerbs && wantedVerbs.includes(verbData.verb)) {
        continue;
      }

      // Prüfe, ob das Verb bereits verwendet wurde
      if (verbData.lemma && foundVerbs.has(verbData.lemma)) {
        foundDuplicateVerb = true;
        break;
      }

      // check Verb trash
      if (
        (verbData.lemma && this.trash.get("verbs")?.has(verbData.lemma)) ||
        (verbData.lemma && this.trash.get("repeatedVerbs")?.has(verbData.lemma))
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

  private checkWantedNouns(
    nouns: SentenceType["nounsParsed"],
    wantedNouns: string[],
    sentenceHistory: SentenceType[],
    checkInHistory = false
  ): boolean {
    if (checkInHistory) {
      // If any of the wanted nouns are in the recently used nouns
      // then don't include them in the current sentence
      const sentencesUsed = sentenceHistory;
      const nounIsInLastSentence =
        sentencesUsed.length > 0 &&
        sentencesUsed[sentencesUsed.length - 1].nounsParsed.some((n) =>
          wantedNouns.includes(n.noun)
        );

      if (nounIsInLastSentence) {
        return false;
      }
    }

    return nouns.some((n) => wantedNouns.includes(n.noun));
  }

  private checkWantedVerbs(
    words: SentenceType["verbsParsed"],
    wantedVerbs: string[],
    sentenceHistory: SentenceType[],
    checkInHistory = false
  ): boolean {
    if (checkInHistory) {
      // If any of the wanted verbs are in the recently used verbs
      // then don't include them in the current sentence
      const sentencesUsed = sentenceHistory;
      const verbIsInLastSentence =
        sentencesUsed.length > 0 &&
        sentencesUsed[sentencesUsed.length - 1].verbsParsed.some((v) =>
          wantedVerbs.includes(v.verb)
        );

      if (verbIsInLastSentence) {
        return false;
      }
    }

    return words.some((v) => v.isRoot && wantedVerbs.includes(v.verb));
  }

  private pickRandomSentences(): SentenceType[] | undefined {
    const result: SentenceType[] = [];
    const foundNouns: Set<string> = new Set();
    const foundVerbs: Set<string> = new Set();
    const sentCount = this.getFilter("sentCount")!;
    const wantedNouns = this.getFilter("nouns");
    const wantedVerbs = this.getFilter("verbs");
    const wantedWordsCount =
      (wantedNouns?.length || 0) + (wantedVerbs?.length || 0);
    const checkInHistory = wantedWordsCount > 1;

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

      // If wanted nouns or verbs are set, only check if they are present in the sentence. Ootherwise fallback to regular checks.

      // Check verbs
      let verbCheck = true;
      let nounCheck = true;

      if (wantedWordsCount) {
        verbCheck = wantedVerbs
          ? this.checkWantedVerbs(
              sent.verbsParsed,
              wantedVerbs,
              this.sentencesUsed.concat(result),
              checkInHistory
            )
          : true;
        nounCheck = wantedNouns
          ? this.checkWantedNouns(
              sent.nounsParsed,
              wantedNouns,
              this.sentencesUsed.concat(result),
              checkInHistory
            )
          : true;
      } else {
        verbCheck = this.checkVerbs(sent, result.length, foundVerbs);
        nounCheck = this.checkNouns(sent, foundNouns);
      }

      if (!wantedWordsCount && !nounCheck && !verbCheck) {
        continue;
      } else if (wantedWordsCount === 1 && (!nounCheck || !verbCheck)) {
        continue;
      } else if (wantedWordsCount > 1 && !nounCheck && !verbCheck) {
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

  public getRandomVerb(): string | undefined {
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

    this.clearFilters();

    if (filters) {
      this.setFilters(filters);
    }

    // Lege die Anzahl der Sätze fest, wenn sie nicht gesetzt ist
    if (!this.getFilter("sentCount")) {
      const sentCount = Story.getRandomSentCount(
        1,
        7,
        [100, 10, 100, 100, 50, 40, 10]
      );
      // if (this.getFilter("mode") === "repeatVerb") {
      //   sentCount = Story.getRandomSentCount(4, 8, [100, 100, 100, 40, 10]);
      // }
      this.addFilter("sentCount", sentCount);
    }

    if (!(this.getFilter("nouns") && !this.getFilter("verbs"))) {
      // randomly choose a verb so every sentence will have the same verb
      const weights = [100, 15];
      const setRandomVerb = weightedRandom([0, 1], weights) === 1;

      if (setRandomVerb) {
        const verb = this.getRandomVerb();
        if (verb) {
          this.addFilter("verbs", [verb]);
        }
      }
    }
  }

  public generateText({
    times = 1,
    filters,
  }: GenerateTextProps = {}): GenerateTextResult[] {
    /**
     * Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält.
     */
    const result: GenerateTextResult[] = [];
    const validFilters = filters ? v.parse(FiltersSchema, filters) : undefined;

    for (let n = 0; n < this.sentences.length; n++) {
      // Bevor wir die Sätze auswählen, setzen wir die Filter
      this.createFilters(validFilters);
      const wantedNouns = this.getFilter("nouns");
      const wantedVerbs = this.getFilter("verbs");
      const sents = this.pickRandomSentences();

      if (!sents) {
        break;
      }

      const sortedSents: SentenceType[] = Story.sortSentences(sents);

      // Speichere die Sätze im Trash
      for (const sent of sortedSents) {
        this.trash.get("sentences")?.add(sent.id);

        if (sent.verbsLemma.size) {
          this.trash.get("verbs")?.addMany(sent.verbsLemma);
          if (wantedVerbs) {
            this.trash.get("repeatedVerbs")?.add(sent.rootVerbLemma);
          }
        }
        if (sent.nounsLemma.size) {
          this.trash.get("nouns")?.addMany(sent.nounsLemma);
          if (wantedNouns) {
            this.trash.get("repeatedNouns")?.addMany(sent.nounsLemma);
          }
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
        usedSentences: sortedSents,
      });

      // Speichere den Verlauf der verwendeten Sätze
      this.sentencesUsed.push(...sortedSents);

      if (result.length === times) {
        break;
      }
    }

    return result;
  }
}
