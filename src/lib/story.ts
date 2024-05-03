import weightedRandom from "@/lib/weighted-random";
import { Trash, TrashConfig } from "./trash";
import { z } from "zod";

// GetSentencesReturnType = tuple[list[Sentence], dict | None] | None
type GetSentencesReturnType =
  | [SentenceType[], Record<string, unknown> | undefined]
  | undefined;

const SeparatedCSVField = z.string().transform((val) => val.split(";"));
const TransformBooleanString = z
  .enum(["True", "False"])
  .transform((value) => value === "True");

export const SentenceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  root_verb: z.string().min(1),
  root_verb_lemma: z.string().min(1),
  verbs: SeparatedCSVField,
  verbs_lemma: SeparatedCSVField,
  nouns: SeparatedCSVField,
  nouns_lemma: SeparatedCSVField,
  source: z.string().min(1),
  ends_with_colon: TransformBooleanString,
  has_and: TransformBooleanString,
});

type SentenceType = z.infer<typeof SentenceSchema>;

// class SentenceType {
//   // parameter properties
//   constructor(
//     public id: string,
//     public text: string,
//     public root_verb: string,
//     public root_verb_lemma: string,
//     public verbs: string[] = [],
//     public verbs_lemma: string[] = [],
//     public nouns: string[] = [],
//     public nouns_lemma: string[] = [],
//     public source: string,
//     public ends_with_colon: boolean = false,
//     public has_and: boolean = false
//   ) {}

//   static field_to_list(v: string): string[] {
//     if (!v) {
//       return [];
//     }

//     return v.split(";");
//   }
// }

export class StoryConfig {
  readonly trash: typeof TrashConfig;
  readonly first_sentence_excluded_words: Set<string> = new Set([
    "aber",
    "andererseits",
    "außerdem",
    "daher",
    "deshalb",
    "doch",
    "einerseits",
    "jedoch",
    "nichtsdestotrotz",
    "sondern",
    "sowohl",
    "stattdessen",
    "trotzdem",
    "weder noch",
    "weder",
    "zudem",
    "zwar",
    "dennoch",
    "denn",
    "infolgedessen",
    "folglich",
    "dementsprechend",
    "demzufolge",
    "somit",
  ]);

  constructor(trash?: typeof TrashConfig) {
    if (trash && trash instanceof Object) {
      this.trash = trash;
    } else {
      this.trash = { ...TrashConfig };
    }
  }
}

export class Story {
  protected sentences: SentenceType[];
  private readonly config: StoryConfig;
  private trashBins: Map<string, Trash>;

  // parameter properties
  constructor(sentences: SentenceType[], config?: StoryConfig) {
    this.sentences = sentences;
    this.trashBins = new Map();

    // set config
    if (config instanceof StoryConfig) {
      this.config = config;
    } else {
      this.config = new StoryConfig();
    }

    // create new trash bins
    for (const key of this.config.trash.TRASH_KEYS) {
      const configKey =
        `${key.toUpperCase()}_MAX_ITEMS` as keyof typeof TrashConfig;
      const maxItems = this.config.trash[configKey] as number;
      this.trashBins.set(key, new Trash([], maxItems));
    }
  }

  static isIntersecting<T>(setA: Set<T>, setB: Set<T>): boolean {
    for (const elem of setA) {
      if (setB.has(elem)) {
        return true;
      }
    }
    return false;
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
        if (this.trashBins.get("verbs")?.hasAny(verbsLemmaWithoutRootVerb)) {
          continue;
        }
      } else {
        // Not the same verbs in the sentence
        if (sent.verbs_lemma.some((v) => foundVerbs.has(v))) {
          continue;
        }

        // check Verb trash
        if (this.trashBins.get("verbs")?.hasAny(sent.verbs_lemma)) {
          continue;
        }

        // check Verb trash
        if (this.trashBins.get("repeated_verbs")?.hasAny(sent.verbs_lemma)) {
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
      if (this.trashBins.get("sources")?.has(sent.source)) {
        continue;
      }

      // check Sentence trash
      if (this.trashBins.get("sentences")?.has(sent.id)) {
        continue;
      }

      // check Noun trash
      if (this.trashBins.get("nouns")?.hasAny(sent.nouns_lemma)) {
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
        !this.trashBins.get("repeated_verbs")?.has(sent.root_verb_lemma) &&
        !this.trashBins.get("verbs")?.has(sent.root_verb_lemma)
      ) {
        return sent.root_verb;
      }
    }
    return undefined;
  }

  static sortSentences(sentences: SentenceType[]): SentenceType[] {
    // Stelle Sätze ans Ende, die das Wort "und" enthalten.
    sentences.sort((sent1, _) => (sent1.has_and ? 1 : -1));

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
        this.trashBins.get("sentences")?.add(sent.id);

        if (repeated_verb) {
          this.trashBins.get("repeated_verbs")?.add(repeated_verb);
        }
        if (sent.verbs_lemma) {
          this.trashBins.get("verbs")?.add(sent.verbs_lemma);
        }
        if (sent.nouns_lemma) {
          this.trashBins.get("nouns")?.add(sent.nouns_lemma);
        }

        this.trashBins.get("sources")?.add(sent.source);
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
