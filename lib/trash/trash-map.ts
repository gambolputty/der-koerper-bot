import * as v from "valibot";

import { Trash, TrashConfigSchema } from "./trash";

const STORY_TRASH_DIRECTORY = new URL(".storytrash", import.meta.url);

const TrashMapConfigSchema = v.record(
  v.picklist(["verbs", "nouns", "repeatedWords", "sentences", "sources"]),
  TrashConfigSchema
);

type TrashMapConfig = v.Output<typeof TrashMapConfigSchema>;

const DEFAULT_TRASH_CONFIG: TrashMapConfig = {
  verbs: { maxItems: 20 },
  repeatedWords: { maxItems: 5 },
  nouns: { maxItems: 40 },
  sentences: { maxItems: 300 },
  sources: { maxItems: 70 },
};

export class TrashMap extends Map<string, Trash> {
  readonly configs: TrashMapConfig;

  constructor(configs?: TrashMapConfig) {
    super();

    // Setze die Konfigurationen für die Trash-Bins
    this.configs = v.parse(TrashMapConfigSchema, {
      ...DEFAULT_TRASH_CONFIG,
      ...(configs || {}),
    });

    // Erstelle leere Trash-Bins
    this.initTrashBins();
  }

  private initTrashBins(): void {
    for (const [key, config] of Object.entries(this.configs)) {
      this.set(key, new Trash({ config }));
    }
  }

  public reset(): void {
    this.clear();
    this.initTrashBins();
  }

  async loadTrashBinsFromFile(): Promise<boolean> {
    // Prüfe, ob der Ordner STORY_TRASH_DIRECTORY existiert
    // Wenn nicht, erstelle ihn.
    const directory = STORY_TRASH_DIRECTORY;
    const fs = await import("node:fs");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    if (
      !fs ||
      !fs.existsSync ||
      !fs.mkdirSync ||
      !fs.readdirSync ||
      !fs.readFileSync ||
      !join ||
      !fileURLToPath
    ) {
      throw new Error("Node modules not available");
    }

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }

    // Lade alle Text-Dateien aus dem Ordner.
    // Eine Trash-Datei wird als Text-Datei gespeichert.
    // Die Einträge sind Strings, die durch einen Zeilenwechsel getrennt sind.
    // Die Dateinamen sind die Schlüssel der Trash-Map.
    const files = fs.readdirSync(directory);
    if (!files.length) {
      return false;
    }

    for (const file of files) {
      const key = file.replace(".txt", "") as keyof TrashMapConfig;
      const filePath = join(fileURLToPath(directory), file);
      const content = fs.readFileSync(filePath, "utf-8");
      const values = content.length ? content.split("\n") : [];

      this.set(
        key,
        new Trash({ initialValues: new Set(values), config: this.configs[key] })
      );
    }

    return true;
  }

  async saveTrashBinsToFile(): Promise<boolean> {
    // Prüfe, ob der Ordner STORY_TRASH_DIRECTORY existiert
    // Wenn nicht, erstelle ihn.
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const fs = await import("node:fs");

    if (
      !fs ||
      !fs.existsSync ||
      !fs.mkdirSync ||
      !fs.writeFileSync ||
      !join ||
      !fileURLToPath
    ) {
      throw new Error("Node modules not available");
    }

    const directory = STORY_TRASH_DIRECTORY;

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }

    // Speichere alle Trash-Bins in Text-Dateien im Ordner.
    for (const [key, trash] of this.entries()) {
      const filePath = join(fileURLToPath(directory), `${key}.txt`);
      fs.writeFileSync(filePath, Array.from(trash).join("\n"));
    }

    return true;
  }
}
