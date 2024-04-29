import csv
import sys

from mastodon import Mastodon
from tenacity import retry, stop_after_attempt, wait_random

from der_koerper_bot.config import config
from der_koerper_bot.story import Sentence, Story, StoryConfig

csv.field_size_limit(sys.maxsize)


@retry(stop=stop_after_attempt(5), wait=wait_random(min=10, max=35))
def post_to_mastodon(text: str):
    #   Set up Mastodon
    mastodon = Mastodon(
        access_token=config["mastodon"]["AccessToken"],
        api_base_url=config["mastodon"]["ApiBaseUrl"],
    )

    mastodon.status_post(text, language="de")


def init():
    with open("sentences.csv", "r") as file:
        reader = csv.DictReader(file)
        sentences = [Sentence(**row) for row in reader]  # type: ignore
    story_config = StoryConfig(
        **{"trash": {"SENTENCES_MAX_ITEMS": 1000}}  # type: ignore
    )
    story = Story(
        config=story_config,
        sentences=sentences,
        from_file=True,
    )
    text = next(story.generate_text_in_loop(1))

    post_to_mastodon(text)
    story.save_trash_files()


if __name__ == "__main__":
    init()
