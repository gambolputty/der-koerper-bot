import fs from "node:fs";
import path from "node:path";

import { TrashMap } from "../lib";
import { Story } from "../lib/story";

export const generateText = async () => {
  const trashMap = new TrashMap();
  await trashMap.loadTrashBinsFromFile();
  const csvUrl = new URL("../lib/assets/sentences.csv", import.meta.url);
  const sentences = await Story.loadSentencesFromCSV(csvUrl);
  const story = new Story({
    sentences,
    trashConfig: {
      sentences: { maxItems: 99999999999 },
    },
    trashMap,
    options: {
      generateTextTimes: 10000,
    },
  });
  const textArr = story.generateText();
  const text = textArr.map((r) => r.text).join("\n");
  await trashMap.saveTrashBinsToFile();

  return text;
};

console.log("Generating text...");
const text = await generateText();
console.log("Text generated");

// save text to .txt file
const filePath = path.join(process.cwd(), "book.txt");
fs.writeFileSync(filePath, text);
console.log(`Text saved to ${filePath}`);
