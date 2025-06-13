import fs from "node:fs";
import path from "node:path";

import { TrashMap } from "../lib";
import { Story } from "../lib/story";

export const generateText = async () => {
  const trashMap = new TrashMap();
  await trashMap.loadTrashBinsFromFile();
  const csvUrl = new URL("../lib/assets/sentences.csv", import.meta.url);
  const sentences = await Story.loadSentencesFromCSV(csvUrl);

  const allTexts: string[] = [];

  // Konzeptuelles Kunstbuch: Sätze werden allmählich länger
  // Beginne mit 1 Satz und steigere langsam bis zu mehr Sätzen
  const maxSentCount = 10; // Mehr Durchläufe für ein ganzes Buch
  const maxTextsPerSentCount = 100; // Maximale Anzahl Texte bei niedrigster sentCount
  const minTextsPerSentCount = 50; // Minimale Anzahl Texte bei höchster sentCount

  for (let sentCount = 1; sentCount <= maxSentCount; sentCount++) {
    // Lineare Abnahme: Je höher sentCount, desto weniger textsPerSentCount
    const textsPerSentCount = Math.round(
      maxTextsPerSentCount -
        ((maxTextsPerSentCount - minTextsPerSentCount) * (sentCount - 1)) /
          (maxSentCount - 1)
    );

    console.log(
      `Generating ${textsPerSentCount} texts with ${sentCount} sentence(s)...`
    );

    const story = new Story({
      sentences,
      trashConfig: {
        sentences: { maxItems: 99999999999 },
      },
      trashMap,
      options: {
        generateTextTimes: textsPerSentCount,
        filters: {
          sentCount: sentCount,
          excludedWords: ["kann", "wird", "hat"],
        },
      },
    });

    const textArr = story.generateText();
    const sectionTexts = textArr.map((r) => r.text);

    // Füge Überschrift für den Abschnitt hinzu
    allTexts.push(`--- ${sentCount} ${sentCount === 1 ? "Satz" : "Sätze"} ---`);
    allTexts.push(""); // Leerzeile nach der Überschrift
    allTexts.push(...sectionTexts);

    // Füge eine Leerzeile zwischen den verschiedenen Satz-Längen hinzu
    if (sentCount < maxSentCount) {
      allTexts.push(""); // Leerzeile als Trenner
    }
  }

  await trashMap.saveTrashBinsToFile();
  return allTexts.join("\n");
};

console.log("Generating text...");
const text = await generateText();
console.log("Text generated");

// save text to .txt file
const filePath = path.join(process.cwd(), "book.txt");
fs.writeFileSync(filePath, text);
console.log(`Text saved to ${filePath}`);
