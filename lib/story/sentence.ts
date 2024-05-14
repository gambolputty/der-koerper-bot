import * as v from "valibot";

const SeparatedCSVField = v.transform(v.string(), (val): Set<string> => {
  if (!val || val === "") {
    return new Set();
  }
  const items = val.split(";");
  return new Set(items);
});

const BooleanString = v.coerce(v.boolean(), (val) => val === "1");
const getTokens = (text: string): string[] => text.match(/\b\w+\b/g) || [];
const parseVerbs = (
  rootVerb: string,
  verbs: Set<string>,
  verbsLemma: Set<string>
) => {
  const result: { verb: string; lemma: string | undefined; isRoot: boolean }[] =
    [];
  const lemmaArray = Array.from(verbsLemma);
  const verbsArray = Array.from(verbs);

  verbs.forEach((verb) => {
    const verbIndex = verbsArray.findIndex((v) => v === verb);
    const lemma = lemmaArray[verbIndex];
    const isRoot = verb === rootVerb;
    result.push({ verb, lemma, isRoot });
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
    endsWithColon: BooleanString,
    hasAnd: BooleanString,
  }),
  (input) => ({
    ...input,
    tokens: getTokens(input.text),
    verbsParsed: parseVerbs(input.rootVerb, input.verbs, input.verbsLemma),
  })
);

export type SentenceType = v.Output<typeof SentenceSchema>;
