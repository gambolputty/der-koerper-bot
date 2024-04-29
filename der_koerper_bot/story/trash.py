from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Trash:

    data: list[str] = field(default_factory=list)
    max_items: int | None = None

    def add(self, value: str | list[str]):
        """
        Fügt einen Wert zu data hinzu. Wenn mehr als max_items Einträge gespeichert wurden, werden die ältesten Einträge gelöscht.
        """
        if isinstance(value, list):
            self.data.extend(value)
        else:
            self.data.append(value)

        if self.max_items:
            self.clean()

    def clean(self):
        """
        Löscht die ältesten Einträge in data, wenn mehr als max_items
        Einträge gespeichert wurden.
        """
        if self.max_items and len(self.data) > self.max_items:
            self.data = self.data[-self.max_items :]

    def has(self, value: str):
        """
        Prüft, ob ein Wert in data enthalten ist.
        """
        return value in self.data

    def has_any(self, values: list[str]):
        """
        Prüft, ob mindestens ein Wert in data enthalten ist.
        """
        return any(val in self.data for val in values)

    @classmethod
    def from_file(
        cls, file_path: Path | str, max_items: int | None = None, create: bool = False
    ):
        """
        Liest die Daten aus einer Datei und speichert sie in self.data.
        """
        if create and not Path(file_path).exists():
            return cls(max_items=max_items)

        with open(file_path, "r") as file:
            return cls(data=[line.strip() for line in file], max_items=max_items)

    def save_to_file(self, file_path: Path | str):
        """
        Speichert die Daten in self.data in einer Datei.
        """
        with open(file_path, "w") as file:
            for value in self.data:
                file.write(f"{value}\n")


# trash = Trash([], 5)

# for x in range(10):
#     trash.add(f"value{x}")

# trash.data
# trash.clean()
# trash.data
