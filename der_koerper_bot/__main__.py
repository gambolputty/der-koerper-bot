import csv
import json
import sys

from der_koerper_bot.story import Sentence, Story

csv.field_size_limit(sys.maxsize)


def init():
    with open("sentences.json", "r") as file:
        sentences = [Sentence(**sent) for sent in json.load(file)]

    story = Story(sentences=sentences, from_file=True)

    with open("story.txt", "w") as file:
        for text in story.start(500):
            # for line in textwrap.wrap(text, 80):
            file.write(f"{text}\n")

    story.save_trash_files()


if __name__ == "__main__":
    init()
