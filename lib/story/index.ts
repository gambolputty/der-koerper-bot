import weightedRandom from "./weighted-random";
import { TrashMap } from "../trash";
import * as v from "valibot";

import { parse } from "csv-parse/sync";
import { SentenceSchema } from "./sentence";
import type { SentenceType } from "./sentence";

type GetSentencesReturnType =
  | [SentenceType[], Record<string, unknown> | undefined]
  | undefined;

export class StoryConfig {
  // prettier-ignore
  readonly first_sentence_excluded_words: Set<string> = new Set([
    "aber", "andererseits", "außerdem", "daher", "deshalb", "doch", "einerseits", "jedoch", "nichtsdestotrotz", "sondern", "sowohl", "stattdessen", "trotzdem", "weder noch", "weder", "zudem", "zwar", "dennoch", "denn", "infolgedessen", "folglich", "dementsprechend", "demzufolge", "somit", "beiden", "beide", "beides",
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

  static parseSentences(data: any): SentenceType[] {
    const sentences: SentenceType[] = [];

    for (let i = 0; i < data.length; i++) {
      sentences.push(v.parse(SentenceSchema, data[i]));
    }

    return sentences;
  }

  static async loadSentencesFromCSV() {
    let data;
    const csvUrl = new URL("../assets/sentences.csv", import.meta.url);

    // Check if code is running in Node.js
    if (typeof window === "undefined") {
      // In Node.js, use fs to read the file
      const fs = await import("fs");
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

  private pickRandomSentences(
    count: number,
    repeatedVerb?: string
  ): SentenceType[] | undefined {
    const result: SentenceType[] = [];
    const foundNouns: Set<string> = new Set();
    const foundVerbs: Set<string> = new Set();
    let foundAnd = false;
    this.sentences.sort(() => Math.random() - 0.5);

    for (const sent of this.sentences) {
      if (repeatedVerb) {
        // check Verb
        if (sent.root_verb !== repeatedVerb) {
          continue;
        }

        // Compare verbs, but exclude root_verb_lemma
        const verbsLemmaWithoutRootVerb = sent.verbs_lemma.filter(
          (v) => v !== sent.root_verb_lemma
        );

        if (verbsLemmaWithoutRootVerb.some((v) => foundVerbs.has(v))) {
          continue;
        }

        // check Verb trash, but exclude root_verb_lemma
        if (this.trash.get("verbs")?.hasAny(verbsLemmaWithoutRootVerb)) {
          continue;
        }
      } else {
        // Not the same verbs in the sentence
        if (sent.verbs_lemma.some((v) => foundVerbs.has(v))) {
          continue;
        }

        // check Verb trash
        if (this.trash.get("verbs")?.hasAny(sent.verbs_lemma)) {
          continue;
        }

        // check Verb trash
        if (this.trash.get("repeatedVerbs")?.hasAny(sent.verbs_lemma)) {
          continue;
        }
      }

      // check "and"
      // "and" should only appear once
      if (foundAnd) {
        continue;
      }

      // No colon at the end allowed
      if (sent.ends_with_colon) {
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

      // check Noun trash
      if (this.trash.get("nouns")?.hasAny(sent.nouns_lemma)) {
        continue;
      }

      // Not the same nouns in the sentence
      if (sent.nouns_lemma.some((n) => foundNouns.has(n))) {
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
          words.some((word) =>
            this.config.first_sentence_excluded_words.has(word)
          )
        ) {
          continue;
        }
      }

      result.push(sent);
      sent.nouns_lemma.forEach((n) => foundNouns.add(n));
      sent.verbs_lemma.forEach((v) => foundVerbs.add(v));

      // check "and"
      if (sent.text.includes(" und ")) {
        foundAnd = true;
      }

      if (result.length === count) {
        break;
      }
    }

    return result.length > 0 ? result : undefined;
  }

  private pickRandomVerb(): string | undefined {
    for (let sent of this.sentences) {
      if (
        !this.trash.get("repeatedVerbs")?.has(sent.root_verb_lemma) &&
        !this.trash.get("verbs")?.has(sent.root_verb_lemma)
      ) {
        return sent.root_verb;
      }
    }
    return undefined;
  }

  static sortSentences(sentences: SentenceType[]): SentenceType[] {
    // Stelle Sätze ans Ende, die das Wort "und" enthalten.
    sentences.sort((sent1, _) => (sent1.has_and ? -1 : 1));

    // Sätze, die mit einem Doppelpunkt enden, müssen an den Anfang.
    // sentences.sort((sent1, sent2) => (sent1.ends_with_colon ? -1 : 1));

    // Sätze, die einen Doppelpunkt beinhalten, aber mit ihm Enden,
    // müssen ans Ende.
    sentences.sort((sent1, _) => {
      if (sent1.text.includes(":") && !sent1.ends_with_colon) {
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
    const sent_count: number = Story.getRandomSentCount(
      1,
      8,
      [80, 10, 80, 100, 100, 50, 30, 10]
    );
    const sents: SentenceType[] | undefined =
      this.pickRandomSentences(sent_count);

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
    const sent_count: number = Story.getRandomSentCount(
      4,
      10,
      [100, 100, 100, 40, 10, 10, 5]
    );

    // Wähle ein Verb aus, das nicht im Trash liegt.
    // Das Verb wird über mehrere Sätze verwendet.
    this.sentences.sort(() => Math.random() - 0.5);
    const repeated_verb: string | undefined = this.pickRandomVerb();

    const sents: SentenceType[] | undefined = this.pickRandomSentences(
      sent_count,
      repeated_verb
    );

    if (!sents) {
      return;
    }

    return [sents, { repeated_verb }];
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
      const get_sentences_result: GetSentencesReturnType = this.getSentences();

      if (!get_sentences_result) {
        continue;
      }

      const [sents, resultInfo] = get_sentences_result;

      if (!sents) {
        continue;
      }

      const sortedSents: SentenceType[] = Story.sortSentences(sents);

      if (!sortedSents) {
        continue;
      }

      const repeated_verb: string | undefined =
        (resultInfo?.repeated_verb as string) || undefined;

      // Speichere die Sätze im Trash
      for (const sent of sortedSents) {
        this.trash.get("sentences")?.add(sent.id);

        if (repeated_verb) {
          this.trash.get("repeatedVerbs")?.add(repeated_verb);
        }
        if (sent.verbs_lemma.length) {
          this.trash.get("verbs")?.addMany(sent.verbs_lemma);
        }
        if (sent.nouns_lemma.length) {
          this.trash.get("nouns")?.addMany(sent.nouns_lemma);
        }

        this.trash.get("sources")?.add(sent.source);
      }

      // Füge die Sätze zusammen
      const sents_len: number = sortedSents.length;
      const text_list: string[] = [];

      for (let i = 0; i < sents_len; i++) {
        const sent: SentenceType = sortedSents[i];
        let text: string = sent.text;

        const last_index: number = sents_len - 1;
        if (sents_len > 1) {
          if (i === last_index) {
            text = ` und ${text}`;
          } else if (i !== 0) {
            text = `, ${text}`;
          }
        }

        text_list.push(text);
      }

      // Satzanfang und Ende
      const text: string = `Der Körper ${text_list.join("")}.`;

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
