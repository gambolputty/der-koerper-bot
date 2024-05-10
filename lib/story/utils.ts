export const loadFile = async (fileUrl: URL | string) => {
  if (typeof window !== "undefined") {
    // Code to load file in browser environment
    const response = await fetch(fileUrl.toString());
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
