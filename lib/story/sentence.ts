import * as v from "valibot";

const SeparatedCSVField = v.transform(v.string(), (val): Set<string> => {
  if (!val || val === "") {
    return new Set();
  }
  const items = val.split(";");
  return new Set(items);
});

export type ParseVerbResult = {
  word: string;
  lemma: string | undefined;
  isRoot: boolean;
};
export type ParseNounResult = {
  word: string;
  lemma: string | undefined;
};

const BooleanString = v.coerce(v.boolean(), (val) => val === "1");

// Src: https://github.com/winkjs/wink-tokenizer/blob/master/src/wink-tokenizer.js#L59
const getWords = (text: string): string[] =>
  text.match(
    /[a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF][a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF']*/gi
  ) || [];

const parseVerbs = (
  rootVerb: string,
  verbs: Set<string>,
  verbsLemma: Set<string>
) => {
  const result: ParseVerbResult[] = [];
  const lemmaArray = Array.from(verbsLemma);
  const verbsArray = Array.from(verbs);

  verbs.forEach((word) => {
    const verbIndex = verbsArray.findIndex((v) => v === word);
    const lemma = lemmaArray[verbIndex];
    const isRoot = word === rootVerb;
    result.push({ word, lemma, isRoot });
  });

  return result;
};

const parseNouns = (nouns: Set<string>, nounsLemma: Set<string>) => {
  const result: ParseNounResult[] = [];
  const lemmaArray = Array.from(nounsLemma);
  const nounsArray = Array.from(nouns);

  nouns.forEach((word) => {
    const index = nounsArray.findIndex((v) => v === word);
    const lemma = lemmaArray[index];
    result.push({ word, lemma });
  });

  return result;
};

export const SentenceSchema = v.transform(
  v.object({
    id: v.string([v.minLength(1)]),
    text: v.string([v.minLength(1)]),
    rootVerb: v.string([v.minLength(1)]),
    rootVerbLemma: v.string([v.minLength(1)]),
    verbs: SeparatedCSVField,
    verbsLemma: SeparatedCSVField,
    nouns: SeparatedCSVField,
    nounsLemma: SeparatedCSVField,
    source: v.string([v.minLength(1)]),
    hasAnd: BooleanString,
    hasColon: BooleanString,
    endsWithColon: BooleanString,
  }),
  (input) => {
    const text = input.text;
    const words = getWords(text);

    return {
      ...input,
      words,
      verbsParsed: parseVerbs(input.rootVerb, input.verbs, input.verbsLemma),
      nounsParsed: parseNouns(input.nouns, input.nounsLemma),
    };
  }
);

export type SentenceType = v.Output<typeof SentenceSchema>;
