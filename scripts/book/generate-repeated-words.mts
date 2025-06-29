import fs from "node:fs";
import path from "node:path";

import { TrashMap } from "../../lib";
import { Story } from "../../lib/story";

// Lade bereits verwendete Sätze aus book-data.json
const loadUsedSentences = (): Set<string> => {
  const bookDataPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "output",
    "book-data.json"
  );

  if (!fs.existsSync(bookDataPath)) {
    console.log("book-data.json not found, proceeding without exclusions.");
    return new Set();
  }

  const bookData = JSON.parse(fs.readFileSync(bookDataPath, "utf-8"));
  const usedSentences = new Set<string>();

  for (const sentCountGroup of bookData) {
    for (const section of sentCountGroup.sections) {
      if (section.usedSentences) {
        for (const sentence of section.usedSentences) {
          if (sentence.text) {
            usedSentences.add(sentence.text);
          }
        }
      }
    }
  }

  console.log(
    `Loaded ${usedSentences.size} already used sentences from book-data.json`
  );
  return usedSentences;
};

const usedSentences = loadUsedSentences();

export const generateTextWithWords = async (targetWord: string) => {
  const csvUrl = new URL("../../lib/assets/sentences.csv", import.meta.url);
  const sentences = await Story.loadSentencesFromCSV(csvUrl);
  const blocklist = new Set([
    "macht den klang und nicht das instrument erzeugt die töne",
  ]);
  const minSentenceCount = 3;

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

  // Filtere Sätze, die mit dem Suchwort beginnen und entferne bereits verwendete
  const filteredTexts = textArr
    .filter((r) => {
      // Überspringe Sätze aus der Blockliste
      if (blocklist.has(r.text.trim())) {
        return false;
      }

      // Prüfe, ob der Satz mit dem Suchwort beginnt
      const textTrimmed = r.text.trim();
      const startsWithTarget = textTrimmed
        .toLowerCase()
        .startsWith(`der körper ${targetWord.toLowerCase()}`);

      // Darf keine Kommas oder Klammern enthalten
      const containsBadChar = /[,()]/.test(textTrimmed);

      // Prüfe, ob der verwendete Satz bereits in book-data.json verwendet wurde
      const sentenceText = r.usedSentences[0]?.text;
      const isAlreadyUsed = sentenceText && usedSentences.has(sentenceText);

      return startsWithTarget && !containsBadChar && !isAlreadyUsed;
    })
    .map((r) => r.usedSentences[0].text);

  // Filtere Sätze, die weniger als 3 Wörter enthalten
  if (filteredTexts.length < minSentenceCount) {
    console.log(
      `Not enough sentences found for word "${targetWord}". Found only ${filteredTexts.length}, but at least ${minSentenceCount} are required.`
    );
    return;
  }

  console.log(
    `Found ${filteredTexts.length} texts that start with "Der Körper ${targetWord}" and are not already used in book-data.json.`
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

  // Ergebnis verwerfen, wenn kein Text gefunden wurde
  if (!result || result.trim() === "") {
    console.log(`No text found for word: ${word}`);
    continue;
  }

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
