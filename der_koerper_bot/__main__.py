import csv
import sys

from der_koerper_bot.story import Sentence, Story, StoryConfig

csv.field_size_limit(sys.maxsize)


def init():
    with open("sentences.csv", "r") as file:
        reader = csv.DictReader(file)
        sentences = [Sentence(**row) for row in reader]  # type: ignore

    story_config = StoryConfig(
        VERB_TRASH_MAX_ITEMS=14,
        REPEATED_VERB_TRASH_MAX_ITEMS=3,
        NOUN_TRASH_MAX_ITEMS=40,
        SOURCE_TRASH_MAX_ITEMS=70,
    )
    story = Story(
        config=story_config,
        sentences=sentences,
    )

    with open("story.txt", "w") as file:
        for text in story.generate_text_in_loop(500):
            # for line in textwrap.wrap(text, 80):
            file.write(f"{text}\n")


if __name__ == "__main__":
    init()
