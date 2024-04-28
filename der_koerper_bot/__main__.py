import csv
import sys

from der_koerper_bot.story import Sentence, Story

csv.field_size_limit(sys.maxsize)


def init():
    with open("sentences.csv", "r") as file:
        reader = csv.DictReader(file)
        sentences = [Sentence(**row) for row in reader]  # type: ignore

    story = Story(sentences=sentences)

    with open("story.txt", "w") as file:
        for text in story.start(500):
            # for line in textwrap.wrap(text, 80):
            file.write(f"{text}\n")


if __name__ == "__main__":
    init()
