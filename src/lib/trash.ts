export const TrashConfig = {
  TRASH_KEYS: ["verbs", "repeated_verbs", "nouns", "sentences", "sources"],
  VERBS_MAX_ITEMS: 14,
  REPEATED_VERBS_MAX_ITEMS: 3,
  NOUNS_MAX_ITEMS: 40,
  SOURCES_MAX_ITEMS: 70,
  SENTENCES_MAX_ITEMS: undefined,
} as const;

export class Trash {
  constructor(
    private data: string[] = [],
    public maxItems?: number
  ) {}

  public add(value: string | string[]): void {
    if (Array.isArray(value)) {
      if (!value.length || value.some((val) => !val.length)) {
        throw new Error(
          "value must not be an empty list or contain empty strings"
        );
      }

      this.data.push(...value);
    } else {
      if (!value.length) {
        throw new Error("value must not be an empty string");
      }
      this.data.push(value);
    }

    this.clean();
  }

  private clean(): void {
    if (this.maxItems && this.data.length > this.maxItems) {
      this.data = this.data.slice(-this.maxItems);
    }
  }

  public has(value: string): boolean {
    return this.data.includes(value);
  }

  public hasAny(values: string[]): boolean {
    return values.some((val) => this.data.includes(val));
  }
}
