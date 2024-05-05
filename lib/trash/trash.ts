export type TrashConfig = {
  maxItems?: number;
};

const defaultTrashConfig: TrashConfig = {
  maxItems: undefined,
};

export class Trash extends Set<string> {
  private readonly config: TrashConfig;

  constructor(initialValues?: string[], config?: TrashConfig) {
    super();
    // Setze die Konfigurationen für die Trash-Bins bevor die Werte hinzugefügt werden. Dadurch wird sichergestellt, dass this.config definiert ist, bevor this.add aufgerufen wird.
    this.config = config || { ...defaultTrashConfig };

    if (initialValues) {
      initialValues.forEach((item) => this.add(item));
    }
    this.truncateItems();
  }

  add(value: string): this {
    super.add(value);
    this.truncateItems();
    return this;
  }

  public addMany(value: string[]): void {
    if (!Array.isArray(value)) {
      throw new Error("value must be an array");
    }
    if (!value.length || value.some((val) => !val.length)) {
      throw new Error(
        "value must not be an empty list or contain empty strings"
      );
    }

    for (const val of value) {
      this.add(val);
    }
  }

  private truncateItems(): void {
    // Wenn maxItems definiert ist und die Anzahl der Elemente im Trash größer ist als maxItems, lösche die ältesten Elemente.
    const maxItems = this.config.maxItems;
    if (maxItems && this.size > maxItems) {
      while (this.size > maxItems) {
        const firstItem = this.values().next().value;
        this.delete(firstItem);
      }
    }
  }

  public hasAny(values: string[]): boolean {
    return values.some((value) => this.has(value));
  }
}
