import { parse } from "csv-parse/browser/esm/sync";
import { Story, SentenceSchema } from "./src/index.ts";
import { readFileSync } from "fs";

const readCSVFile = () => {
  const rawData = readFileSync("./src/sentences.csv", "utf8");
  const data = parse(rawData, {
    columns: true,
  });
  return data;
};

const parseCSVData = (data: any) => {
  const sentences: any = [];

  for (let i = 0; i < data.length; i++) {
    sentences.push(SentenceSchema.parse(data[i]));
  }

  return sentences;
};

const csvData = readCSVFile();
const sentences = parseCSVData(csvData);
const story = new Story(sentences);
const textArr = story.generateText(10);

const text = textArr.join("\n");
const result = text;

console.clear();
console.log(result);
