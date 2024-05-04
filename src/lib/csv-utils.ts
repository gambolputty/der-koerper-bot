import { parse } from "csv-parse/browser/esm/sync";

export const parseCSVText = (text: any) =>
  parse(text, {
    columns: true,
  });
