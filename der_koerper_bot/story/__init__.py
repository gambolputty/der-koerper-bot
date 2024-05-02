import random
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, field_validator

from der_koerper_bot.story.trash import Trash, TrashConfig


class Sentence(BaseModel):
    id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    root_verb: str = Field(min_length=1)
    root_verb_lemma: str = Field(min_length=1)
    verbs: list[str] = []
    verbs_lemma: list[str] = []
    nouns: list[str] = []
    nouns_lemma: list[str] = []
    source: str = Field(min_length=1)
    ends_with_colon: bool = False

    @field_validator("verbs", "verbs_lemma", "nouns", "nouns_lemma", mode="before")
    @classmethod
    def field_to_list(cls, v: str):
        if not v:
            return []

        return v.split(";")


class StoryConfig(BaseModel):
    trash: TrashConfig = TrashConfig()

    # fmt: off
    first_sentence_excluded_words: list[str] = [
        "aber", "andererseits", "außerdem", "daher", "deshalb", "doch", "einerseits", "jedoch", "nichtsdestotrotz", "sondern", "sowohl", "stattdessen", "trotzdem", "weder noch", "weder", "zudem", "zwar" "dennoch", "denn", "infolgedessen", "folglich", "dementsprechend", "demzufolge", "somit",
    ]
    # fmt: on


GetSentencesReturnType = tuple[list[Sentence], dict | None] | None


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
        self,
        count: int,
        repeated_verb: str | None = None,
    ) -> list[Sentence] | None:
        result = []
        found_nouns = set()
        found_verbs = set()
        found_and = False
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

                # checke Verb-Trash
                if self.trash_bins["repeated_verbs"].has_any(sent.verbs_lemma):
                    continue

            # checke "und"
            # "und" darf nur einmal vorkommen
            if found_and:
                continue

            # Doppelpunkt am Ende nicht erlaubt
            if sent.ends_with_colon:
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

            # Wenn erster Satz, dann keine Sätze mit ausgeschlossenen Wörtern
            if not result:
                words = re.findall(r"\b\w+\b", sent.text)
                if any(
                    word in self.config.first_sentence_excluded_words for word in words
                ):
                    continue

            result.append(sent)
            found_nouns.update(sent.nouns_lemma)
            found_verbs.update(sent.verbs_lemma)

            # checke "und"
            if " und " in sent.text:
                found_and = True

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
        # Stelle Sätze ans Ende, die das Wort "und" enthalten.
        sentences.sort(key=lambda sent: " und " in sent.text)

        # Sätze, die mit einem Doppelpunkt enden, müssen an den Anfang.
        # sentences.sort(key=lambda sent: sent.ends_with_colon, reverse=True)

        # Sätze, die einen Doppelpunkt beinhalten, aber mit ihm Enden,
        # müssen ans Ende.
        sentences.sort(
            key=lambda sent: ":" in sent.text and not sent.ends_with_colon,
        )

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

    def get_enumerated_sentences(self) -> GetSentencesReturnType:
        """
        Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält.
        """

        sent_count = self.get_random_sent_count(
            start=1,
            end=8,
            weights=[80, 10, 80, 100, 100, 50, 30, 10],
        )
        sents = self.pick_random_sentences(sent_count)

        if not sents:
            return

        return sents, None

    def get_enumerated_sentences_and_repeat_verb(self) -> GetSentencesReturnType:
        """
        Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält. Es wird ein Verb ausgewählt und nur Sätze mit diesem Verb werden ausgewählt.
        """

        # Generiere eine zufällige Anzahl von Sätzen.
        sent_count = self.get_random_sent_count(
            start=4,
            end=10,
            weights=[100, 100, 100, 40, 10, 10, 5],
        )

        # Wähle ein Verb aus, das nicht im Trash liegt.
        # Das Verb wird über mehrere Sätze verwendet.
        random.shuffle(self.sentences)
        repeated_verb = self.pick_random_verb()

        sents = self.pick_random_sentences(sent_count, repeated_verb)

        if not sents:
            return

        # Entferne das erste Wort aus jedem Satz, außer dem ersten Satz.
        # for i, sent in enumerate(sents):
        #     if i == 0:
        #         continue
        #     sents[i] = Sentence(
        #         id=sent.id, text=sent.text.split(" ", 1)[1], verb=sent.verb
        #     )

        # Join the items with commas.

        return sents, {"repeated_verb": repeated_verb}

    def get_sentences(self) -> GetSentencesReturnType:
        # Liste der Funktionen
        functions = [
            self.get_enumerated_sentences,
            self.get_enumerated_sentences_and_repeat_verb,
        ]

        # Gewichte für die Funktionen
        weights = [100, 15]

        # Zufällige Auswahl unter Berücksichtigung der Gewichte
        get_sentences_fn = random.choices(functions, weights=weights, k=1)[0]

        # Aufrufen der ausgewählten Funktion
        return get_sentences_fn()

    def generate_text(self, times: int = 1):
        """
        Fängt an eine Geschichte zu erzählen.
        """
        result: list[str] = []

        for n in range(len(self.sentences)):
            get_sentences_result = self.get_sentences()
            if not get_sentences_result:
                continue

            sents, info = get_sentences_result

            if not sents:
                continue

            sents = self.sort_sentences(sents)

            if not sents:
                continue

            # Speichere die Sätze im Trash
            repeated_verb = info.get("repeated_verb", None) if info else None
            for sent in sents:
                self.trash_bins["sentences"].add(sent.id)

                if repeated_verb:
                    self.trash_bins["repeated_verbs"].add(repeated_verb)
                if sent.verbs_lemma:
                    self.trash_bins["verbs"].add(sent.verbs_lemma)
                if sent.nouns_lemma:
                    self.trash_bins["nouns"].add(sent.nouns_lemma)

                self.trash_bins["sources"].add(sent.source)

            # Füge die Sätze zusammen
            sents_len = len(sents)
            text_list = []

            for i, sent in enumerate(sents):
                # Füge vor jedem Satz ein Komma ein, außer vor dem letzten Satz.
                # Vor dem letzten Satz kommt ein "und".
                # Sätze mit ":" am Ende bekommen ihr Satzzeichen zurück.
                text = sent.text

                # if sent.ends_with_colon:
                #     text = text + ":"

                last_index = sents_len - 1
                if sents_len > 1:
                    # Prüfe ob der Satz davor mit einem Doppeltpunkt endet
                    # prev_sent_ends_with_colon = (
                    #     sents[i - 1].ends_with_colon if i > 0 else False
                    # )

                    # Und, Komma, Doppelpunkt (Leerzeichen)
                    if i == last_index:
                        text = f" und {text}"
                    # elif prev_sent_ends_with_colon:
                    #     text = f" {text}"
                    elif i != 0:
                        text = f", {text}"

                text_list.append(text)

            # Satzanfang und Ende
            text = f"Der Körper {''.join(text_list)}."

            # Füge den Text zur Liste hinzu
            result.append(text)

            if len(result) == times:
                break

        return result
