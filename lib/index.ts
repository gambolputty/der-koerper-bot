import * as random from "./random";
import type { Filters, GenerateTextResult, Options } from "./story";
import { SentenceSchema, Story } from "./story";
import type { SentenceType } from "./story/sentence";
import { Trash, TrashMap } from "./trash";

// eslint-disable-next-line
export { SentenceSchema, Story, Trash, TrashMap, random };
export type {
  Filters,
  Options as GenerateTextProps,
  GenerateTextResult,
  SentenceType,
};
