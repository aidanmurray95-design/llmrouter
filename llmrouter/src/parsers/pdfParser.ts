import * as pdfjsLib from 'pdfjs-dist';
import type { FileParseResult } from '../types/fileTypes';

// Configure PDF.js worker
// Using CDN for worker as it's simpler for Vite bundling
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Parses a PDF file and extracts text content
 */
export async function parsePDF(arrayBuffer: ArrayBuffer, filename: string): Promise<FileParseResult> {
  try {
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const numPages = pdf.numPages;
    const pages: string[] = [];

    // Extract text from each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Combine text items with spacing
        const pageText = textContent.items
          .map((item: any) => {
            if ('str' in item) {
              return item.str;
            }
            return '';
          })
          .join(' ')
          .trim();

        if (pageText) {
          pages.push(`[Page ${pageNum}]\n${pageText}\n`);
        }
      } catch (error) {
        console.warn(`Error extracting text from page ${pageNum}:`, error);
        pages.push(`[Page ${pageNum}]\n[Error extracting text from this page]\n`);
      }
    }

    // Check if any content was extracted
    if (pages.length === 0 || pages.every(p => p.includes('[Error extracting text'))) {
      return {
        content: '',
        error: 'No text content could be extracted from this PDF'
      };
    }

    // Format the final content
    const content = `=== Document: ${filename} ===\nPages: ${numPages}\n\n${pages.join('\n')}`;

    return {
      content,
      metadata: {
        pageCount: numPages
      }
    };
  } catch (error: any) {
    console.error('PDF parsing error:', error);

    // Handle specific errors
    if (error.name === 'PasswordException') {
      return {
        content: '',
        error: 'This PDF is password-protected and cannot be read'
      };
    }

    if (error.name === 'InvalidPDFException') {
      return {
        content: '',
        error: 'This file appears to be corrupted or is not a valid PDF'
      };
    }

    return {
      content: '',
      error: `Failed to parse PDF: ${error.message || 'Unknown error'}`
    };
  }
}
