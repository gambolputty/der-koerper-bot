import random
from dataclasses import dataclass, field
from pathlib import Path

from pydantic import BaseModel

from der_koerper_bot.story.trash import Trash


class Sentence(BaseModel):
    id: str
    text: str
    verb: str
    nouns: set[str]


@dataclass
class Story:
    """
    Eine Klasse die eine Geschichte erzählen kann.
    Sie nimmt eine Liste von Sätzen entgegen und kann daraus eine Geschichte generieren.
    Für jeden Satz ist auch jedes Verb hinterlegt. Wir wollen einen ausgeglichenen Text generieren, in dem die Verben nicht zu oft wiederholt werden.
    Deshalb speichern wir id Ids der Sätze, die wir bereits verwendet haben, in einem Trash-Objekt:
    Beim Hinzuügen einer neuen Id wird geprüft, ob sie bereits im Trash-Objekt ist. Wenn ja, wird der Satz nicht hinzugefügt. Wenn nein, wird der Satz hinzugefügt und die Id im Trash-Objekt gespeichert.
    """

    sentences: list[Sentence] = field(default_factory=list)
    from_file: bool = False
    verb_trash: Trash = field(default_factory=Trash)
    noun_trash: Trash = field(default_factory=Trash)
    sentence_trash: Trash = field(default_factory=Trash)
    trash_files_path: Path = field(default=Path("der_koerper_bot/trash_files"))

    def __post_init__(self):
        if self.from_file:
            self.load_trash_from_file()

        self.verb_trash.max_items = 10
        self.noun_trash.max_items = 25
        self.trash_files_path.mkdir(exist_ok=True)

    def load_trash_from_file(self):
        self.verb_trash = Trash.from_file(self.trash_files_path / "verb_trash.txt")
        self.noun_trash = Trash.from_file(self.trash_files_path / "noun_trash.txt")
        self.sentence_trash = Trash.from_file(
            self.trash_files_path / "sentence_trash.txt"
        )

    def save_trash_files(self):
        self.verb_trash.save_to_file(self.trash_files_path / "verb_trash.txt")
        self.noun_trash.save_to_file(self.trash_files_path / "noun_trash.txt")
        self.sentence_trash.save_to_file(self.trash_files_path / "sentence_trash.txt")

    def pick_random_sentences(
        self, count: int, selected_verb: str | None = None
    ) -> list[Sentence] | None:
        result = []
        found_nouns = set()
        found_verbs = set()
        random.shuffle(self.sentences)

        for sent in self.sentences:
            if selected_verb:
                # checke Verb
                if sent.verb != selected_verb:
                    continue
            else:
                # checke Verb-Trash
                if self.verb_trash.has(sent.verb):
                    continue

                # Nicht die selben Verben im Satz
                if sent.verb in found_verbs:
                    continue

            # checke Satz-Trash
            if self.sentence_trash.has(sent.id):
                continue

            # Nicht die selben Nomen im Satz
            if found_nouns.intersection(sent.nouns):
                continue

            # checke Nomen-Trash
            if any(self.noun_trash.has(noun) for noun in sent.nouns):
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
        sentences = sorted(
            sentences,
            key=lambda sent: "," in sent.text or " und " in sent.text,
        )

        return sentences

    def get_sentences(self) -> list[Sentence] | None:
        """
        Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält.
        """
        sent_count = random.randint(1, 15)
        sents = self.pick_random_sentences(sent_count)

        return sents

    def get_sentences_with_same_verb(self) -> list[Sentence] | None:
        """
        Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält. Es wird ein Verb ausgewählt und nur Sätze mit diesem Verb werden verwendet.
        """
        sent_count = random.randint(1, 15)
        verb = random.choice(self.sentences).verb
        sents = self.pick_random_sentences(sent_count, selected_verb=verb)

        # Entferne das erste Wort aus jedem Satz, außer dem ersten Satz.
        # for i, sent in enumerate(sents):
        #     if i == 0:
        #         continue
        #     sents[i] = Sentence(
        #         id=sent.id, text=sent.text.split(" ", 1)[1], verb=sent.verb
        #     )

        # Join the items with commas.

        return sents

    def start(self, times: int = 1):
        """
        Fängt an eine Geschichte zu erzählen.
        """
        for n in range(times):
            # chceck if n is divisible by 10
            if n % 3 == 0:
                sents = self.get_sentences_with_same_verb()
            else:
                sents = self.get_sentences()

            if not sents:
                continue

            sents = self.sort_sentences(sents)

            # Speichere die Sätze im Trash
            for sent in sents:
                self.sentence_trash.add(sent.id)
                self.verb_trash.add(sent.verb)
                for noun in sent.nouns:
                    self.noun_trash.add(noun)

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
