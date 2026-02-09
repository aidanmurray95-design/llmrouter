import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export interface ExportMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  provider?: string;
  attachments?: Array<{ name: string; type: string }>;
}

export function exportToExcel(messages: ExportMessage[]): void {
  // Prepare data for Excel
  const data = messages.map(msg => ({
    Timestamp: new Date(msg.timestamp).toLocaleString(),
    Role: msg.role === 'user' ? 'You' : 'Assistant',
    Provider: msg.provider || '',
    Content: msg.content,
    Attachments: msg.attachments?.map(a => a.name).join(', ') || ''
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, // Timestamp
    { wch: 10 }, // Role
    { wch: 15 }, // Provider
    { wch: 80 }, // Content
    { wch: 30 }  // Attachments
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Chat History');

  // Generate filename with timestamp
  const filename = `chat-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
}

export function exportToPDF(messages: ExportMessage[]): void {
  // Create new PDF document
  const doc = new jsPDF();

  // Set document properties
  doc.setProperties({
    title: 'Chat History Export',
    subject: 'Multi-LLM Chatbot Conversation',
    author: 'Multi-LLM Chatbot',
    keywords: 'chat, export, conversation',
    creator: 'Multi-LLM Chatbot'
  });

  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Chat History Export', 105, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });

  // Starting position
  let yPosition = 40;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const maxWidth = 170; // Max width for text

  // Add messages
  messages.forEach((msg, index) => {
    // Check if we need a new page
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    }

    // Add message header
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const role = msg.role === 'user' ? 'You' : 'Assistant';
    const timestamp = new Date(msg.timestamp).toLocaleString();
    let header = `${role}`;

    if (msg.provider) {
      header += ` (${msg.provider})`;
    }
    header += ` - ${timestamp}`;

    doc.text(header, margin, yPosition);
    yPosition += 6;

    // Add attachments if any
    if (msg.attachments && msg.attachments.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      const attachmentText = `Attachments: ${msg.attachments.map(a => a.name).join(', ')}`;
      doc.text(attachmentText, margin, yPosition);
      yPosition += 5;
    }

    // Add message content
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Split text to fit width
    const lines = doc.splitTextToSize(msg.content, maxWidth);

    // Check if content fits on current page
    const contentHeight = lines.length * 5;
    if (yPosition + contentHeight > pageHeight - 20) {
      doc.addPage();
      yPosition = 20;
    }

    doc.text(lines, margin, yPosition);
    yPosition += contentHeight + 8;

    // Add separator line
    if (index < messages.length - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition, 190, yPosition);
      yPosition += 8;
    }
  });

  // Add page numbers
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Page ${i} of ${pageCount}`,
      105,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Generate filename with timestamp
  const filename = `chat-export-${new Date().toISOString().slice(0, 10)}.pdf`;

  // Download file
  doc.save(filename);
}
