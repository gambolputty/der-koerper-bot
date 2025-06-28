import fs from "node:fs";
import path from "node:path";

import { TrashMap } from "../../lib";
import { Story } from "../../lib/story";

export const generateTextWithWords = async (targetWord: string) => {
  const csvUrl = new URL("../../lib/assets/sentences.csv", import.meta.url);
  const sentences = await Story.loadSentencesFromCSV(csvUrl);

  console.log(`Generating texts containing word: ${targetWord}...`);

  const story = new Story({
    sentences,
    trashMap: new TrashMap({
      sentences: { maxItems: 99999999999 },
      verbs: { maxItems: 4 },
      nouns: { maxItems: 4 },
      sources: { maxItems: 4 },
    }),
    options: {
      generateTextTimes: 1000,
      filters: {
        wantedWords: [targetWord],
        sentCount: 1,
        // Keine sentCount-Begrenzung - lasse alle Satzlängen zu
      },
    },
  });

  const textArr = story.generateText();

  console.log(`Generated ${textArr.length} texts with the wanted words.`);

  if (textArr.length === 0) {
    console.log("No texts found containing the wanted words.");
    return "";
  }

  // Filtere Sätze, die mit dem Suchwort beginnen und entferne "Der Körper " am Anfang
  const filteredTexts = textArr
    .filter((r) => {
      // Prüfe, ob der Satz mit dem Suchwort beginnt
      const textTrimmed = r.text.trim();
      const startsWithTarget = textTrimmed
        .toLowerCase()
        .startsWith(`der körper ${targetWord.toLowerCase()}`);
      return startsWithTarget;
    })
    .map((r) => r.usedSentences[0].text);

  console.log(
    `Found ${filteredTexts.length} texts that start with "Der Körper ${targetWord}".`
  );

  return filteredTexts.join("\n");
};

// Load target words from frequencies.json
const frequenciesUrl = new URL(
  "../../lib/assets/frequencies.json",
  import.meta.url
);
const frequenciesData = JSON.parse(fs.readFileSync(frequenciesUrl, "utf-8"));
const allVerbs = frequenciesData.VERB;

// Filter verbs with frequency <= 70
const targetWords = Object.keys(allVerbs).filter(
  (verb) => allVerbs[verb] <= 50
);

console.log(
  `Processing ${targetWords.length} verbs (with frequency <= 70) from frequencies.json...`
);

for (const word of targetWords) {
  console.log(`Generating text with wanted word: ${word}...`);
  const result = await generateTextWithWords(word);
  console.log(`Text generated for word: ${word}`);

  // save text to .txt file in the output subdirectory
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const outputDir = path.join(scriptDir, "output", "repeated-words");

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const textFilePath = path.join(outputDir, `repeated-word-${word}.txt`);
  fs.writeFileSync(textFilePath, result);
  console.log(`Text saved to ${textFilePath}`);
}
