import { Story, TrashMap } from "./lib";

// await trashMap.loadTrashBinsFromFile();
const csvUrl = new URL("./lib/assets/sentences.csv", import.meta.url);
const sentences = await Story.loadSentencesFromCSV(csvUrl);
const story = new Story({
  sentences,
  options: {
    generateTextTimes: 600,
    enforceExactSentCount: false,
    filters: {
      wantedWords: ["benötigt"], // Verwende die gewünschten Wörter aus der Variable
      sentCount: 1,
      // Keine sentCount-Begrenzung - lasse alle Satzlängen zu
    },
  },
  trashMap: new TrashMap({
    sentences: { maxItems: 99999999999 },
    verbs: { maxItems: 4 },
    nouns: { maxItems: 4 },
    sources: { maxItems: 4 },
  }),
});
console.time("generated text");
const textArr = story.generateText();
console.timeEnd("generated text");
const text = textArr.map((r) => r.text).join("\n");
// await trashMap.saveTrashBinsToFile();
console.log(text);
console.log(`\nGenerated ${textArr.length} items`);

// const freqUrl = new URL("./lib/assets/frequencies.json", import.meta.url);
// const frequencies = await Story.loadFrequenciesFromJSON(freqUrl);
// console.log(frequencies);
// console.log(trashMap);
// console.log(textArr);
