import * as XLSX from 'xlsx';
import type { FileParseResult } from '../types/fileTypes';

/**
 * Parses an Excel or CSV file and extracts content as formatted text
 */
export async function parseExcel(arrayBuffer: ArrayBuffer, filename: string): Promise<FileParseResult> {
  try {
    // Read the workbook
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        content: '',
        error: 'No sheets found in this file'
      };
    }

    const sheetNames = workbook.SheetNames;
    const sheets: string[] = [];
    let totalRows = 0;

    // Process each sheet
    for (const sheetName of sheetNames) {
      try {
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
          sheets.push(`[Sheet: ${sheetName}]\n[Empty sheet]\n`);
          continue;
        }

        // Convert sheet to CSV format (preserves structure)
        const csv = XLSX.utils.sheet_to_csv(worksheet);

        if (!csv || csv.trim().length === 0) {
          sheets.push(`[Sheet: ${sheetName}]\n[No data]\n`);
          continue;
        }

        // Count rows (excluding header)
        const rows = csv.split('\n').filter(line => line.trim().length > 0);
        totalRows += rows.length;

        // Format as markdown table for better readability
        const lines = rows.filter(line => line.trim());
        if (lines.length > 0) {
          // Convert CSV to markdown table
          const markdownTable = convertCSVToMarkdown(lines);
          sheets.push(`[Sheet: ${sheetName}]\n${markdownTable}\n`);
        }
      } catch (error) {
        console.warn(`Error parsing sheet ${sheetName}:`, error);
        sheets.push(`[Sheet: ${sheetName}]\n[Error parsing this sheet]\n`);
      }
    }

    // Check if any content was extracted
    if (sheets.length === 0 || sheets.every(s => s.includes('[Error parsing') || s.includes('[No data]'))) {
      return {
        content: '',
        error: 'No data could be extracted from this file'
      };
    }

    // Format the final content
    const content = `=== Spreadsheet: ${filename} ===\nSheets: ${sheetNames.length} | Total Rows: ${totalRows}\n\n${sheets.join('\n')}`;

    return {
      content,
      metadata: {
        sheetNames,
        rowCount: totalRows
      }
    };
  } catch (error: any) {
    console.error('Excel parsing error:', error);

    // Handle specific errors
    if (error.message?.includes('password') || error.message?.includes('encrypted')) {
      return {
        content: '',
        error: 'This file is password-protected and cannot be read'
      };
    }

    return {
      content: '',
      error: `Failed to parse file: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Converts CSV lines to a markdown table format
 */
function convertCSVToMarkdown(lines: string[]): string {
  if (lines.length === 0) return '[No data]';

  // Parse CSV (handle quoted values with commas)
  const rows = lines.map(line => parseCSVLine(line));

  if (rows.length === 0) return '[No data]';

  // Build markdown table
  const markdownLines: string[] = [];

  // Header row
  if (rows[0]) {
    markdownLines.push(`| ${rows[0].join(' | ')} |`);
    markdownLines.push(`| ${rows[0].map(() => '---').join(' | ')} |`);
  }

  // Data rows (limit to first 20 rows for readability)
  const maxRows = Math.min(rows.length, 21); // 1 header + 20 data rows
  for (let i = 1; i < maxRows; i++) {
    if (rows[i]) {
      markdownLines.push(`| ${rows[i].join(' | ')} |`);
    }
  }

  // Add truncation notice if there are more rows
  if (rows.length > 21) {
    markdownLines.push(`\n[... ${rows.length - 21} more rows]`);
  }

  return markdownLines.join('\n');
}

/**
 * Parses a CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Push the last value
  result.push(current.trim());

  return result;
}
