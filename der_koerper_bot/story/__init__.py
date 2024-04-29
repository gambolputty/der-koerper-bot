import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import BaseModel, computed_field, field_validator

from der_koerper_bot.story.trash import Trash


class Sentence(BaseModel):
    id: str
    text: str
    verbs: list[str] = []
    verbs_lemma: list[str] = []
    nouns: list[str] = []
    nouns_lemma: list[str] = []
    source: str

    @computed_field
    @property
    def verb(self) -> str:
        return self.verbs[0]

    @field_validator("verbs", "verbs_lemma", "nouns", "nouns_lemma", mode="before")
    @classmethod
    def field_to_list(cls, v: Any):
        return v.split(";")


@dataclass
class Story:
    """
    Eine Klasse, die Sätze mit "Der Körper" + [Verb] generiert. Die Sätze stammen
    aus einer CSV.
    Sätze können ein oder mehrere Verben und Nomen haben. Wir wollen einen ausgeglichenen Text generieren, in dem Verben und Nomen nicht zu oft wiederholt werden. Außerdem soll jeder Satz nur 1x vorkommen.
    """

    VERB_TRASH_MAX_ITEMS = 14
    REPEATED_VERB_TRASH_MAX_ITEMS = 3
    NOUN_TRASH_MAX_ITEMS = 40
    SOURCE_TRASH_MAX_ITEMS = 70

    sentences: list[Sentence] = field(default_factory=list)
    from_file: bool = False
    verb_trash: Trash = field(default_factory=Trash)
    repeated_verb_trash: Trash = field(default_factory=Trash)
    noun_trash: Trash = field(default_factory=Trash)
    sentence_trash: Trash = field(default_factory=Trash)
    source_trash: Trash = field(default_factory=Trash)
    trash_files_path: Path = field(default=Path("der_koerper_bot/trash_files"))

    def __post_init__(self):
        if self.from_file:
            self.load_trash_from_file()

            # create trash_files_path if not exists
            self.trash_files_path.mkdir(exist_ok=True)

        # set Trash config
        self.verb_trash.max_items = self.VERB_TRASH_MAX_ITEMS
        self.repeated_verb_trash.max_items = self.REPEATED_VERB_TRASH_MAX_ITEMS
        self.noun_trash.max_items = self.NOUN_TRASH_MAX_ITEMS
        self.source_trash.max_items = self.SOURCE_TRASH_MAX_ITEMS

    def load_trash_from_file(self):
        self.verb_trash = Trash.from_file(
            self.trash_files_path / "verb_trash.txt", create=True
        )
        self.noun_trash = Trash.from_file(
            self.trash_files_path / "noun_trash.txt", create=True
        )
        self.sentence_trash = Trash.from_file(
            self.trash_files_path / "sentence_trash.txt", create=True
        )
        self.source_trash = Trash.from_file(
            self.trash_files_path / "source_trash.txt", create=True
        )

    def save_trash_files(self):
        self.verb_trash.save_to_file(self.trash_files_path / "verb_trash.txt")
        self.noun_trash.save_to_file(self.trash_files_path / "noun_trash.txt")
        self.sentence_trash.save_to_file(self.trash_files_path / "sentence_trash.txt")
        self.source_trash.save_to_file(self.trash_files_path / "source_trash.txt")

    def pick_random_sentences(
        self, count: int, repeated_verb: str | None = None
    ) -> list[Sentence] | None:
        result = []
        found_nouns = set()
        found_verbs = set()
        random.shuffle(self.sentences)

        for sent in self.sentences:
            if repeated_verb:
                # checke Verb
                if sent.verb != repeated_verb:
                    continue
            else:
                # checke Verb-Trash
                if self.verb_trash.has_any(sent.verbs_lemma):
                    continue

                # Nicht die selben Verben im Satz
                if sent.verb in found_verbs:
                    continue

            # checke Quelle-Trash
            if self.source_trash.has(sent.source):
                continue

            # checke Satz-Trash
            if self.sentence_trash.has(sent.id):
                continue

            # Nicht die selben Nomen im Satz
            if found_nouns.intersection(sent.nouns):
                continue

            # checke Nomen-Trash
            if self.noun_trash.has_any(sent.nouns_lemma):
                continue

            # Keine Einwort-Sätze
            if len(sent.text.split()) == 1:
                continue

            result.append(sent)
            found_nouns.update(sent.nouns)
            found_verbs.add(sent.verb)

            if len(result) == count:
                break
        else:
            return

        return result

    @staticmethod
    def sort_sentences(sentences: list[Sentence]) -> list[Sentence]:
        # Stelle Sätze ans Ende, die ein Komma oder das Wort "und" enthalten.
        # sentences = sorted(
        #     sentences,
        #     key=lambda sent: "," in sent.text or " und " in sent.text,
        # )

        return sentences

    @staticmethod
    def get_random_sent_count(start: int, end: int, weights: list[int]) -> int:
        # Generiere eine zufällige Anzahl von Sätzen.
        # Manche Werte sollen häufiger vorkommen als andere.

        # Liste der möglichen Werte
        values = list(range(start, end + 1))

        # Zufällige Auswahl unter Berücksichtigung der Gewichte
        return random.choices(values, weights=weights, k=1)[0]

    def get_enumerated_sentences(self) -> list[Sentence] | None:
        """
        Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält.
        """
        sent_count = random.randint(1, 10)
        sents = self.pick_random_sentences(sent_count)

        return sents

    def get_enumerated_sentences_and_repeat_verb(self) -> list[Sentence] | None:
        """
        Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält. Es wird ein Verb ausgewählt und nur Sätze mit diesem Verb werden ausgewählt.
        """
        # Generiere eine zufällige Anzahl von Sätzen.
        # Manche Werte sollen häufiger vorkommen als andere.
        sent_count = self.get_random_sent_count(
            4,
            10,
            [10, 10, 10, 10, 2, 2, 2],
        )

        # Wähle ein Verb aus, das nicht im Trash liegt.
        # Das Verb wird über mehrere Sätze verwendet.
        random.shuffle(self.sentences)
        repeated_verb = next(
            (
                sent.verb
                for sent in self.sentences
                if not self.repeated_verb_trash.has(sent.verb)
            )
        )

        sents = self.pick_random_sentences(sent_count, repeated_verb)

        # Entferne das erste Wort aus jedem Satz, außer dem ersten Satz.
        # for i, sent in enumerate(sents):
        #     if i == 0:
        #         continue
        #     sents[i] = Sentence(
        #         id=sent.id, text=sent.text.split(" ", 1)[1], verb=sent.verb
        #     )

        # Join the items with commas.

        return sents

    def get_sentences(self):
        # Liste der Funktionen
        functions = [
            self.get_enumerated_sentences,
            self.get_enumerated_sentences_and_repeat_verb,
        ]

        # Gewichte für die Funktionen
        weights = [10, 6]

        # Zufällige Auswahl unter Berücksichtigung der Gewichte
        get_sentences_fn = random.choices(functions, weights=weights, k=1)[0]
        should_add_to_repeated_verb_trash = False

        if get_sentences_fn == "get_enumerated_sentences_and_repeat_verb":
            should_add_to_repeated_verb_trash = True

        # Aufrufen der ausgewählten Funktion
        return get_sentences_fn(), should_add_to_repeated_verb_trash

    def generate_text_in_loop(self, times: int = 1):
        """
        Fängt an eine Geschichte zu erzählen.
        """
        for n in range(times):

            sents, should_add_to_repeated_verb_trash = self.get_sentences()

            if not sents:
                continue

            sents = self.sort_sentences(sents)

            # Speichere die Sätze im Trash
            for sent in sents:
                self.sentence_trash.add(sent.id)
                self.verb_trash.add(sent.verbs_lemma)
                self.noun_trash.add(sent.nouns_lemma)
                self.source_trash.add(sent.source)

                if should_add_to_repeated_verb_trash is True:
                    self.repeated_verb_trash.add(sent.verbs_lemma)

            # Füge die Sätze zusammen
            sents_len = len(sents)
            text_list = []

            for i, sent in enumerate(sents):
                # Füge vor jedem Satz ein Komma ein, außer vor dem letzten Satz.
                # Vor dem letzten Satz kommt ein "und".
                text = sent.text
                if sents_len > 1:
                    if i == sents_len - 1:
                        text = f" und {text}"
                    elif i != 0:
                        text = f", {text}"

                text_list.append(text)

            # Satzanfang und Ende
            text = f"Der Körper {''.join(text_list)}."

            yield text
