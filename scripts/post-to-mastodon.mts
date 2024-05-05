import { createRestAPIClient } from "masto";

import { TrashMap } from "../lib";
import { Story } from "../lib/story";

const createClient = () =>
  createRestAPIClient({
    url: process.env.MASTODON_API_BASE_URL!,
    accessToken: process.env.MASTODON_ACCESS_TOKEN!,
  });

export const postToMastodon = async (text: string) => {
  const client = createClient();
  const status = await client.v1.statuses.create({
    status: text,
    visibility: "public",
  });

  return status;
};

export const generateText = async () => {
  const trashMap = new TrashMap({
    sentences: { maxItems: 300 },
  });
  await trashMap.loadTrashBinsFromFile();
  const csvUrl = new URL("../lib/assets/sentences.csv", import.meta.url);
  const sentences = await Story.loadSentencesFromCSV(csvUrl);
  const story = new Story({
    sentences,
    trashMap,
  });
  const textArr = story.generateText(1);
  const text = textArr.join("\n");
  await trashMap.saveTrashBinsToFile();

  return text;
};

const text = await generateText();
await postToMastodon(text);
