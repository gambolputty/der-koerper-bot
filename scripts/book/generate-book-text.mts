import fs from "node:fs";
import path from "node:path";

import { TrashMap } from "../../lib";
import { Story } from "../../lib/story";

export const generateText = async () => {
  const csvUrl = new URL("../../lib/assets/sentences.csv", import.meta.url);
  const sentences = await Story.loadSentencesFromCSV(csvUrl);

  const allTexts: string[] = [];
  const bookData: Array<{
    sentCount: number;
    sections: Array<{
      text: string;
      usedSentences: unknown[];
      sentCount: number;
    }>;
  }> = [];

  // TrasMap muss außerhalb der Schleife erstellt werden, um die Sätze zu speichern
  const trashMap = new TrashMap({
    sentences: { maxItems: 99999999999999 },
  });

  // Konzeptuelles Kunstbuch: Sätze werden allmählich länger
  // Beginne mit 1 Satz und steigere langsam bis zu mehr Sätzen
  const maxSentCount = 25; // Mehr Durchläufe für ein ganzes Buch
  const maxTextsPerSentCount = 80; // Maximale Anzahl Texte bei niedrigster sentCount
  const minTextsPerSentCount = 80; // Minimale Anzahl Texte bei höchster sentCount

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
      trashMap,
      options: {
        generateTextTimes: textsPerSentCount,
        enforceExactSentCount: true,
        filters: {
          sentCount: sentCount,
          excludedWords: ["kann", "wird", "hat"],
        },
      },
    });

    const textArr = story.generateText();
    const sectionTexts = textArr.map((r) => r.text);

    // Speichere sowohl Text als auch Metadaten für JSON
    const sectionData = textArr.map((r) => ({
      text: r.text,
      usedSentences: r.usedSentences,
      sentCount: sentCount,
    }));

    // Füge Daten zur JSON-Struktur hinzu
    bookData.push({
      sentCount: sentCount,
      sections: sectionData,
    });

    // Füge Überschrift für den Abschnitt hinzu
    allTexts.push(`--- ${sentCount} ${sentCount === 1 ? "Satz" : "Sätze"} ---`);
    allTexts.push(""); // Leerzeile nach der Überschrift
    allTexts.push(...sectionTexts);

    // Füge eine Leerzeile zwischen den verschiedenen Satz-Längen hinzu
    if (sentCount < maxSentCount) {
      allTexts.push(""); // Leerzeile als Trenner
    }
  }

  return { text: allTexts.join("\n"), bookData };
};

console.log("Generating text...");
const result = await generateText();
console.log("Text generated");

// save text to .txt file in the output subdirectory
const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const outputDir = path.join(scriptDir, "output");

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const textFilePath = path.join(outputDir, "book.txt");
fs.writeFileSync(textFilePath, result.text);
console.log(`Text saved to ${textFilePath}`);

// save JSON data for LaTeX generation
const jsonFilePath = path.join(outputDir, "book-data.json");
fs.writeFileSync(jsonFilePath, JSON.stringify(result.bookData, null, 2));
console.log(`Book data saved to ${jsonFilePath}`);
