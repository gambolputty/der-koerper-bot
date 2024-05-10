import Papa from "papaparse";

export const loadFile = async (fileUrl: URL | string) => {
  if (typeof window !== "undefined") {
    // Code to load file in browser environment
    const response = await fetch(fileUrl);
    return await response.text();
  } else {
    // Code to load file in Node.js environment
    const fs = await import("node:fs");
    if (!fs || !fs.readFileSync) {
      throw new Error("fs module not available");
    }
    return fs.readFileSync(fileUrl, "utf8");
  }
};

export const parseCSVData = (csvData: string) => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        resolve(results.data);
      },
      error(err: unknown) {
        reject(err);
      },
    });
  });
};

// import { parse } from 'papaparse';

// function parseCSV(csvText: string): Record<string, string>[] {
//   const { data, errors } = parse(csvText, { header: true });

//   if (errors.length > 0) {
//     throw new Error(`CSV parsing error: ${errors[0].message}`);
//   }

//   return data as Record<string, string>[];
// }
