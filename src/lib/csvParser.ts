/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface CSVRow {
  [key: string]: string | number;
}

export function exportToCSV(data: CSVRow[], fileName: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const val = row[header];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
export function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    // Handle quoted values if any (simple implementation, assumes no escaped quotes inside quotes)
    const values: string[] = [];
    let currentVal = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim());

    const row: CSVRow = {};
    headers.forEach((header, index) => {
      const val = values[index];
      // Try to convert to number if possible
      const numVal = Number(val);
      row[header] = !isNaN(numVal) && isFinite(numVal) && val.trim() !== '' ? numVal : val;
    });
    return row;
  });
}
