import { Story, TrashMap } from "./lib";

console.time("generated text");
const trashMap = new TrashMap();
trashMap.loadTrashBinsFromFile();
const sentences = await Story.loadSentencesFromCSV();
const story = new Story({
  sentences,
  trashMap,
});
const textArr = story.generateText(10);
const text = textArr.join("\n");
trashMap.saveTrashBinsToFile();
console.timeEnd("generated text");

console.log(text);
console.log(trashMap);
