import { Trash, TrashConfig } from "./trash";

const STORY_TRASH_DIRECTORY = new URL(".storytrash", import.meta.url);

export type TrashConfigs = {
  [key: string]: TrashConfig;
};

const defaultTrashConfig: TrashConfigs = {
  verbs: { maxItems: 14 },
  repeatedVerbs: { maxItems: 5 },
  nouns: { maxItems: 40 },
  sentences: { maxItems: 300 },
  sources: { maxItems: 70 },
};

export class TrashMap extends Map<string, Trash> {
  readonly configs: TrashConfigs;

  constructor(configs?: TrashConfigs) {
    super();

    // Setze die Konfigurationen für die Trash-Bins
    if (configs && Object.keys(configs).length) {
      this.configs = { ...defaultTrashConfig, ...configs };
    } else {
      this.configs = { ...defaultTrashConfig };
    }

    // Erstelle leere Trash-Bins
    for (const [key, config] of Object.entries(this.configs)) {
      this.set(key, new Trash([], config));
    }
  }

  async loadTrashBinsFromFile(): Promise<boolean> {
    // Prüfe, ob der Ordner STORY_TRASH_DIRECTORY existiert
    // Wenn nicht, erstelle ihn.
    const directory = STORY_TRASH_DIRECTORY;
    const fs = await import("fs");
    if (
      !fs ||
      !fs.existsSync ||
      !fs.mkdirSync ||
      !fs.readdirSync ||
      !fs.readFileSync
    ) {
      throw new Error("fs module not available");
    }

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }

    // Lade alle Text-Dateien aus dem Ordner.
    // Eine Trash-Datei wird als Text-Datei gespeichert.
    // Die Einträge sind Strings, die durch einen Zeilenwechsel getrennt sind.
    // Die Dateinamen sind die Schlüssel der Trash-Map.
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    if (!join || !fileURLToPath) {
      throw new Error("path module not available");
    }
    const files = fs.readdirSync(directory);

    if (!files.length) {
      return false;
    }

    for (const file of files) {
      const key = file.replace(".txt", "");
      const filePath = join(fileURLToPath(directory), file);
      const content = fs.readFileSync(filePath, "utf-8");
      const values = content.split("\n");

      this.set(key, new Trash(values, this.configs[key]));
    }

    return true;
  }

  async saveTrashBinsToFile(): Promise<boolean> {
    // Prüfe, ob der Ordner STORY_TRASH_DIRECTORY existiert
    // Wenn nicht, erstelle ihn.
    const { join } = await import("path");
    const { fileURLToPath } = await import("url");
    if (!join || !fileURLToPath) {
      throw new Error("path module not available");
    }
    const directory = STORY_TRASH_DIRECTORY;
    const fs = await import("fs");
    if (!fs || !fs.existsSync || !fs.mkdirSync || !fs.writeFileSync) {
      throw new Error("fs module not available");
    }

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }

    // Speichere alle Trash-Bins in Text-Dateien im Ordner.
    for (const [key, trash] of this.entries()) {
      const filePath = join(directory.pathname, `${key}.txt`);
      fs.writeFileSync(filePath, trash.data.join("\n"));
    }

    return true;
  }
}
