import csv
import json
import random
import sys

from der_koerper_bot.story import Sentence, Story, Trash

csv.field_size_limit(sys.maxsize)


def init():
    with open("sentences.json", "r") as file:
        sentences = [Sentence(**sent) for sent in json.load(file)]
        random.shuffle(sentences)

    trash = Trash([], max_values=100)
    story = Story(sentences=sentences, trash=trash)

    with open("story.txt", "w") as file:
        for text in story.start(500):
            # for line in textwrap.wrap(text, 80):
            file.write(f"{text}\n")


if __name__ == "__main__":
    init()
