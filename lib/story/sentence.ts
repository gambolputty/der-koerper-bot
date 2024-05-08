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
  })
);

export type SentenceType = v.Output<typeof SentenceSchema>;
