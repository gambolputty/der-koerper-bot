export type TrashConfig = {
  maxItems?: number;
};

const defaultTrashConfig: TrashConfig = {
  maxItems: undefined,
};

export class Trash {
  constructor(
    public data: string[] = [],
    private readonly config: TrashConfig = defaultTrashConfig
  ) {}

  public add(value: string | string[]): void {
    if (Array.isArray(value)) {
      if (!value.length || value.some((val) => !val.length)) {
        throw new Error(
          "value must not be an empty list or contain empty strings"
        );
      }

      // Filter values that are already in the trash
      for (const val of value) {
        if (!this.data.includes(val)) {
          this.data.push(val);
        }
      }
    } else {
      if (!value.length) {
        throw new Error("value must not be an empty string");
      }
      if (!this.data.includes(value)) {
        this.data.push(value);
      }
    }

    this.clean();
  }

  private clean(): void {
    const maxItems = this.config?.maxItems;
    if (maxItems && this.data.length > maxItems) {
      this.data = this.data.slice(-maxItems);
    }
  }

  public has(value: string): boolean {
    return this.data.includes(value);
  }

  public hasAny(values: string[]): boolean {
    return values.some((val) => this.data.includes(val));
  }
}
