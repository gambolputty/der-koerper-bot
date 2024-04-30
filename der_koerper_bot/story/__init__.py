import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import BaseModel, computed_field, field_validator

from der_koerper_bot.story.trash import Trash, TrashConfig


class Sentence(BaseModel):
    id: str
    text: str
    root_verb: str
    root_verb_lemma: str
    verbs: list[str] = []
    verbs_lemma: list[str] = []
    nouns: list[str] = []
    nouns_lemma: list[str] = []
    source: str

    @field_validator("verbs", "verbs_lemma", "nouns", "nouns_lemma", mode="before")
    @classmethod
    def field_to_list(cls, v: Any):
        return v.split(";")


class StoryConfig(BaseModel):
    trash: TrashConfig = TrashConfig()


@dataclass
class Story:
    """
    Eine Klasse, die Sätze mit "Der Körper" + [Verb] generiert. Die Sätze stammen
    aus einer CSV.
    Sätze können ein oder mehrere Verben und Nomen haben. Wir wollen einen ausgeglichenen Text generieren, in dem Verben und Nomen nicht zu oft wiederholt werden. Außerdem soll jeder Satz nur 1x vorkommen.
    """

    sentences: list[Sentence] = field(default_factory=list)
    from_file: bool = False
    trash_files_path: Path = field(default=Path("der_koerper_bot/trash_files"))

    config: StoryConfig = field(default_factory=StoryConfig)
    trash_bins: dict[str, Trash] = field(init=False)

    def __post_init__(self):
        self.init_trash_bins()

    def init_trash_bins(self):
        # create trash_files_path if not exists
        self.trash_files_path.mkdir(exist_ok=True)

        if self.from_file:
            # load trash bins
            self.trash_bins = {
                key: Trash.from_file(
                    self.trash_files_path / f"{key}.txt",
                    max_items=getattr(self.config.trash, f"{key.upper()}_MAX_ITEMS"),
                    create=True,
                )
                for key in self.config.trash.TRASH_KEYS
            }
        else:
            # create new trash bins
            self.trash_bins = {
                key: Trash(
                    max_items=getattr(self.config.trash, f"{key.upper()}_MAX_ITEMS")
                )
                for key in self.config.trash.TRASH_KEYS
            }

    def save_trash_files(self):
        for key, trash in self.trash_bins.items():
            trash.save_to_file(self.trash_files_path / f"{key}.txt")

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
                if sent.root_verb != repeated_verb:
                    continue

                root_verb_lemma = sent.root_verb_lemma

                # Vergleiche Verben, aber nehme root_verb_lemma aus
                if found_verbs.difference({root_verb_lemma}).intersection(
                    sent.verbs_lemma
                ):
                    continue

                # checke Verb-Trash, aber nehme root_verb_lemma aus
                if self.trash_bins["verbs"].has_any(
                    list(set(sent.verbs_lemma).difference({root_verb_lemma}))
                ):
                    continue

            else:
                # Nicht die selben Verben im Satz
                if found_verbs.intersection(sent.verbs_lemma):
                    continue

                # checke Verb-Trash
                if self.trash_bins["verbs"].has_any(sent.verbs_lemma):
                    continue

            # checke Quelle-Trash
            if self.trash_bins["sources"].has(sent.source):
                continue

            # checke Satz-Trash
            if self.trash_bins["sentences"].has(sent.id):
                continue

            # checke Nomen-Trash
            if self.trash_bins["nouns"].has_any(sent.nouns_lemma):
                continue

            # Nicht die selben Nomen im Satz
            if found_nouns.intersection(sent.nouns_lemma):
                continue

            # Keine Einwort-Sätze
            if len(sent.text.split()) == 1:
                continue

            result.append(sent)
            found_nouns.update(sent.nouns_lemma)
            found_verbs.update(sent.verbs_lemma)

            if len(result) == count:
                break
        else:
            return

        return result

    def pick_random_verb(self):
        return next(
            (
                sent.root_verb
                for sent in self.sentences
                if not self.trash_bins["repeated_verbs"].has(sent.root_verb_lemma)
                and not self.trash_bins["verbs"].has(sent.root_verb_lemma)
            )
        )

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
        result = random.choices(values, weights=weights, k=1)[0]

        return result

    def get_enumerated_sentences(self) -> list[Sentence] | None:
        """
        Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält.
        """
        sent_count = self.get_random_sent_count(
            start=1,
            end=10,
            weights=[20, 10, 80, 100, 100, 50, 30, 10, 5, 5],
        )
        sents = self.pick_random_sentences(sent_count)

        return sents

    def get_enumerated_sentences_and_repeat_verb(self) -> list[Sentence] | None:
        """
        Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält. Es wird ein Verb ausgewählt und nur Sätze mit diesem Verb werden ausgewählt.
        """
        # Generiere eine zufällige Anzahl von Sätzen.
        sent_count = self.get_random_sent_count(
            start=4,
            end=10,
            weights=[100, 100, 100, 40, 20, 20, 10],
        )

        # Wähle ein Verb aus, das nicht im Trash liegt.
        # Das Verb wird über mehrere Sätze verwendet.
        random.shuffle(self.sentences)
        repeated_verb = self.pick_random_verb()

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
        weights = [100, 25]

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
                self.trash_bins["sentences"].add(sent.id)
                self.trash_bins["verbs"].add(sent.verbs_lemma)
                self.trash_bins["nouns"].add(sent.nouns_lemma)
                self.trash_bins["sources"].add(sent.source)

                if should_add_to_repeated_verb_trash is True:
                    self.trash_bins["repeated_verbs"].add(sent.verbs_lemma)

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
