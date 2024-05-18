import { Story, TrashMap } from "./lib";

const trashMap = new TrashMap({
  nouns: { maxItems: 4 },
});
// await trashMap.loadTrashBinsFromFile();
const csvUrl = new URL("./lib/assets/sentences.csv", import.meta.url);
const sentences = await Story.loadSentencesFromCSV(csvUrl);
const story = new Story({
  sentences,
  trashMap,
});
console.time("generated text");
story.updateOptions({
  generateTextTimes: 10,
  filters: {
    // sentCount: 1,
    // verbs: ["weiß"],
    wantedWords: ["weiß", "Haus", "grün"],
    // verbs: ["will", "soll", "weiß"],
    // mode: "repeatVerb",
  },
});
const textArr = story.generateText();
console.timeEnd("generated text");
const text = textArr.map((r) => r.text).join("\n");
// await trashMap.saveTrashBinsToFile();
console.log(text);

// const freqUrl = new URL("./lib/assets/frequencies.json", import.meta.url);
// const frequencies = await Story.loadFrequenciesFromJSON(freqUrl);
// console.log(frequencies);
// console.log(trashMap);
// console.log(textArr);
