import { FILE_CONFIG, type FileAttachment } from '../types/fileTypes';

export class FileUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileUploadError';
  }
}

/**
 * Validates a file against size and type constraints
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > FILE_CONFIG.maxFileSize) {
    const sizeMB = (FILE_CONFIG.maxFileSize / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File "${file.name}" exceeds ${sizeMB}MB limit (${formatFileSize(file.size)})`
    };
  }

  // Check file type
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  if (!FILE_CONFIG.allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File type "${extension}" is not supported. Allowed types: PDF, Excel (.xlsx, .xls), CSV`
    };
  }

  return { valid: true };
}

/**
 * Validates multiple files against total size and count constraints
 */
export function validateFiles(files: File[], existingFiles: FileAttachment[] = []): { valid: boolean; error?: string } {
  // Check file count
  if (files.length + existingFiles.length > FILE_CONFIG.maxFiles) {
    return {
      valid: false,
      error: `Maximum ${FILE_CONFIG.maxFiles} files allowed per message`
    };
  }

  // Check each file
  for (const file of files) {
    const validation = validateFile(file);
    if (!validation.valid) {
      return validation;
    }
  }

  // Check total size
  const newTotalSize = files.reduce((sum, f) => sum + f.size, 0);
  const existingTotalSize = existingFiles.reduce((sum, f) => sum + f.size, 0);
  const totalSize = newTotalSize + existingTotalSize;

  if (totalSize > FILE_CONFIG.maxTotalSize) {
    const maxMB = (FILE_CONFIG.maxTotalSize / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `Total file size exceeds ${maxMB}MB limit`
    };
  }

  return { valid: true };
}

/**
 * Reads a file as ArrayBuffer for parsing
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new FileUploadError('Failed to read file as ArrayBuffer'));
      }
    };

    reader.onerror = () => {
      reject(new FileUploadError(`Failed to read file: ${reader.error?.message || 'Unknown error'}`));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Determines file type from file object
 */
export function getFileType(file: File): 'pdf' | 'excel' | 'csv' {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'pdf') return 'pdf';
  if (extension === 'csv') return 'csv';
  return 'excel'; // xlsx, xls
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Generates a unique ID for file attachments
 */
export function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Truncates content if it exceeds maximum length
 */
export function truncateContent(content: string, maxLength: number = FILE_CONFIG.maxContentLength): { content: string; wasTruncated: boolean } {
  if (content.length <= maxLength) {
    return { content, wasTruncated: false };
  }

  const truncated = content.substring(0, maxLength);
  const lastNewline = truncated.lastIndexOf('\n');
  const finalContent = lastNewline > 0 ? truncated.substring(0, lastNewline) : truncated;

  return {
    content: finalContent + '\n\n[Content truncated...]',
    wasTruncated: true
  };
}

/**
 * Creates a FileAttachment object from file and parsed content
 */
export function createFileAttachment(
  file: File,
  extractedContent: string,
  metadata?: FileAttachment['metadata']
): FileAttachment {
  const { content, wasTruncated } = truncateContent(extractedContent);

  return {
    id: generateFileId(),
    name: file.name,
    type: getFileType(file),
    size: file.size,
    uploadedAt: Date.now(),
    extractedContent: content,
    metadata: {
      ...metadata,
      ...(wasTruncated ? { truncated: true } : {})
    } as FileAttachment['metadata']
  };
}
