import * as v from "valibot";

export const TrashConfigSchema = v.object({
  maxItems: v.optional(v.number([v.minValue(1)])),
});

export type TrashConfig = v.Output<typeof TrashConfigSchema>;

const defaultTrashConfig: TrashConfig = {
  maxItems: undefined,
};

const TrashItemSchema = v.string([v.minLength(1)]);
const TrashItemSetSchema = v.set(TrashItemSchema);
type TrashItem = v.Output<typeof TrashItemSchema>;
type TrashItemSet = v.Output<typeof TrashItemSetSchema>;

export class Trash extends Set<string> {
  private readonly config: TrashConfig;

  constructor({
    initialValues,
    config,
  }: {
    initialValues?: TrashItemSet;
    config?: TrashConfig;
  }) {
    super();
    // Setze die Konfigurationen für die Trash-Bins bevor die Werte hinzugefügt werden. Dadurch wird sichergestellt, dass this.config definiert ist, bevor this.add aufgerufen wird.
    this.config = v.parse(TrashConfigSchema, config) || {
      ...defaultTrashConfig,
    };

    if (initialValues) {
      initialValues.forEach((item) => {
        this.add(v.parse(TrashItemSchema, item));
      });
    }
    this.truncateItems();
  }

  add(value: TrashItem): this {
    const valueParsed = v.parse(TrashItemSchema, value);
    super.add(valueParsed);
    this.truncateItems();
    return this;
  }

  public addMany(value: TrashItemSet): void {
    const valueParsed = v.parse(TrashItemSetSchema, value);
    for (const val of valueParsed) {
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

  public hasAny(values: TrashItemSet): boolean {
    for (const value of values) {
      if (this.has(value)) {
        return true;
      }
    }
    return false;
  }
}
