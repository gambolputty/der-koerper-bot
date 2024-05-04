import { createRestAPIClient } from "masto";
import { Story } from "../src/lib/story";

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

export const generateText = async (sentences) => {
  // // const trashConfig = { SENTENCES_MAX_ITEMS: 1000 };
  // // const storyConfig = new StoryConfig(trashConfig);
  const story = new Story(sentences);
  const textArr = story.generateText(1);
  const text = textArr[0];
  return text;
};

const sentences = await Story.loadSentencesFromCSV();
const text = await generateText(sentences);
