import fs from "node:fs";
import path from "node:path";

import { TrashMap } from "../../lib";
import { Story } from "../../lib/story";

export const generateTextWithWords = async () => {
  const csvUrl = new URL("../../lib/assets/sentences.csv", import.meta.url);
  const sentences = await Story.loadSentencesFromCSV(csvUrl);

  const allTexts: string[] = [];
  const bookData: Array<{
    wantedWords: string[];
    sections: Array<{
      text: string;
      usedSentences: unknown[];
      containedWords: string[];
    }>;
  }> = [];
  const wantedWords = ["benötigt"];

  console.log(
    `Generating texts containing words: ${wantedWords!.join(", ")}...`
  );

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
        wantedWords: ["benötigt"], // Verwende die gewünschten Wörter aus der Variable
        sentCount: 1,
        // Keine sentCount-Begrenzung - lasse alle Satzlängen zu
      },
    },
  });

  const textArr = story.generateText();

  console.log(`Generated ${textArr.length} texts with the wanted words.`);

  if (textArr.length === 0) {
    console.log("No texts found containing the wanted words.");
    return { text: "", bookData: [] };
  }

  // Speichere sowohl Text als auch Metadaten für JSON
  const sectionData = textArr.map((r) => {
    // Finde heraus, welche der gewünschten Wörter im Text enthalten sind
    const textLower = r.text.toLowerCase();
    const containedWords = wantedWords!.filter((word) =>
      textLower.includes(word.toLowerCase())
    );

    return {
      text: r.text,
      usedSentences: r.usedSentences,
      containedWords: containedWords,
    };
  });

  // Füge Daten zur JSON-Struktur hinzu
  bookData.push({
    wantedWords: wantedWords!,
    sections: sectionData,
  });

  // Füge Überschrift hinzu
  allTexts.push(`--- Texte mit Wörtern: ${wantedWords!.join(", ")} ---`);
  allTexts.push(""); // Leerzeile nach der Überschrift

  // Füge alle Texte hinzu
  const sectionTexts = textArr.map((r) => r.text);
  allTexts.push(...sectionTexts);

  return { text: allTexts.join("\n"), bookData };
};

console.log("Generating text with wanted words...");
const result = await generateTextWithWords();
console.log("Text generated");

// save text to .txt file in the output subdirectory
const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const outputDir = path.join(scriptDir, "output");

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const textFilePath = path.join(outputDir, "book-with-words.txt");
fs.writeFileSync(textFilePath, result.text);
console.log(`Text saved to ${textFilePath}`);

// save JSON data for LaTeX generation
const jsonFilePath = path.join(outputDir, "book-with-words-data.json");
fs.writeFileSync(jsonFilePath, JSON.stringify(result.bookData, null, 2));
console.log(`Book data saved to ${jsonFilePath}`);
