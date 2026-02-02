export interface FileAttachment {
  id: string;
  name: string;
  type: 'pdf' | 'excel' | 'csv';
  size: number;
  uploadedAt: number;
  extractedContent: string;
  metadata?: {
    pageCount?: number;      // For PDFs
    sheetNames?: string[];   // For Excel
    rowCount?: number;       // For Excel/CSV
  };
}

export interface FileParseResult {
  content: string;
  metadata?: FileAttachment['metadata'];
  error?: string;
}

export const FILE_CONFIG = {
  maxFileSize: 5 * 1024 * 1024,      // 5MB per file
  maxTotalSize: 10 * 1024 * 1024,    // 10MB total
  maxFiles: 3,                        // Max per message
  maxContentLength: 50000,            // Max extracted text chars
  allowedTypes: {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
    'text/csv': ['.csv']
  },
  allowedExtensions: ['.pdf', '.xlsx', '.xls', '.csv']
};
