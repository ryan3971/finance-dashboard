/**
 * Parse a CSV string into a 2D array of strings.
 * Handles quoted fields and comma delimiters.
 */
export function parseCsv(content: string): string[][] {
  const lines = content
    .split(/\r?\n/)
    .filter(line => line.trim() !== '');

  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  });
}
