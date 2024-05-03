import { SentenceSchema, Story } from "./lib/story";
// @ts-ignore
import data from "./assets/sentences.csv";

export default function () {
  const sentences = [];

  for (let i = 0; i < data.length; i++) {
    sentences.push(SentenceSchema.parse(data[i]));
  }
  const story = new Story(sentences);
  story.generateText(1);
  console.log("Generated");
}
