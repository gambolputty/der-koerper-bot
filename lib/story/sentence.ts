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
  root_verb: v.string([v.minLength(1)]),
  root_verb_lemma: v.string([v.minLength(1)]),
  verbs: SeparatedCSVField,
  verbs_lemma: SeparatedCSVField,
  nouns: SeparatedCSVField,
  nouns_lemma: SeparatedCSVField,
  source: v.string([v.minLength(1)]),
  ends_with_colon: BooleanString,
  has_and: BooleanString,
});

export type SentenceType = v.Output<typeof SentenceSchema>;
