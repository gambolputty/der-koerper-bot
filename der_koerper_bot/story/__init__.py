# %%
import random
import textwrap
from dataclasses import dataclass

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

    sentences: list[Sentence]
    trash: Trash

    def pick_random_sentences(
        self, count: int, selected_verb: str | None = None
    ) -> list[Sentence] | None:
        result = []
        found_nouns = set()
        found_verbs = set()

        for sent in self.sentences:
            # checke Verb
            if selected_verb and sent.verb != selected_verb:
                continue

            # Nicht die selben Nomen im Satz
            if found_nouns.intersection(sent.nouns):
                continue

            # Nicht die selben Verben im Satz
            if not selected_verb and sent.verb in found_verbs:
                continue

            # checke Trash
            if not selected_verb and self.trash.has(sent.verb):
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

        if sents is None:
            return

        # Speichere die Ids der Sätze im Trash-Objekt.
        for sent in sents:
            self.trash.add(sent.verb)
        # self.trash.clean()

        return sents

    def get_sentences_with_same_verb(self) -> list[Sentence] | None:
        """
        Generiert einen Text, der mit "Der Körper" beginnt und eine Aufzählung von Sätzen enthält. Es wird ein Verb ausgewählt und nur Sätze mit diesem Verb werden verwendet.
        """
        sent_count = random.randint(1, 15)
        verb = random.choice(self.sentences).verb
        sents = self.pick_random_sentences(sent_count, selected_verb=verb)

        if not sents:
            return

        # Speichere die Ids der Sätze im Trash-Objekt.
        for sent in sents:
            self.trash.add(sent.verb)
        self.trash.clean()

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
        for _ in range(times):

            sents = self.get_sentences()
            # sents = self.get_sentences_with_same_verb()

            if not sents:
                continue

            sents = self.sort_sentences(sents)
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
