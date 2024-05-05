import * as v from "valibot";

const SeparatedCSVField = v.transform(v.string(), (val) => {
  if (!val || val === "") {
    return [];
  }
  return val.split(";");
});

const BooleanString = v.coerce(v.boolean(), (val) => val === "True");

export const SentenceSchema = v.object({
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
});

export type SentenceType = v.Output<typeof SentenceSchema>;
