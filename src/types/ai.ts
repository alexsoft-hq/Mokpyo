export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  extractedText: string;
  originalFileName?: string;
  fileName?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIReportRequest {
  projectId: string;
  period: 'weekly' | 'monthly';
  startDate?: string;
  endDate?: string;
  templateId?: string;
}

export interface AIReportResponse {
  report: string;
  metadata: {
    period: string;
    startDate: string;
    endDate: string;
    logCount: number;
    goalCount: number;
  };
}

export interface AISummarizeResponse {
  summary: string;
}
