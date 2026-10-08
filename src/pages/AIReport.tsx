import { useTranslation, t } from '@/i18n';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { ReportTemplate } from '@/types/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  FileText,
  Trash2,
  Upload,
  Settings2,
} from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';

export default function AIReport() {
  useTranslation();
  const navigate = useNavigate();
  const { currentProject } = useProject();

  const [aiAvailable, setAIAvailable] = useState<boolean | null>(null);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [report, setReport] = useState('');
  const [metadata, setMetadata] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Template management dialog
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newTemplateFile, setNewTemplateFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Calculate default date range
  useEffect(() => {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start: Date;
    if (period === 'weekly') {
      start = new Date(now);
      start.setDate(start.getDate() - 7);
    } else {
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
    }
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end);
  }, [period]);

  // Check AI availability and load templates
  useEffect(() => {
    api.getAIStatus().then((s) => setAIAvailable(s.available)).catch(() => setAIAvailable(false));
  }, []);

  useEffect(() => {
    if (currentProject) {
      loadTemplates();
    }
  }, [currentProject?.id]);

  const loadTemplates = async () => {
    try {
      const data = await api.getReportTemplates(currentProject?.id);
      setTemplates(data);
    } catch {
      // ignore
    }
  };

  const handleGenerate = async () => {
    if (!currentProject) return;
    setIsGenerating(true);
    setError(null);
    setReport('');
    setMetadata(null);

    try {
      await api.generateReportStream(
        {
          projectId: currentProject.id,
          period,
          startDate,
          endDate,
          templateId: templateId && templateId !== 'none' ? templateId : undefined,
        },
        (chunk) => setReport((prev) => prev + chunk),
        (meta) => setMetadata(meta),
      );
    } catch (err: any) {
      setError(err.message || t("리포트 생성에 실패했습니다."));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTemplateUpload = async () => {
    if (!newTemplateName || !newTemplateFile) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', newTemplateFile);
      formData.append('name', newTemplateName);
      if (newTemplateDesc) formData.append('description', newTemplateDesc);
      if (currentProject) formData.append('projectId', currentProject.id);

      await api.uploadReportTemplate(formData);
      setNewTemplateName('');
      setNewTemplateDesc('');
      setNewTemplateFile(null);
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || t("템플릿 업로드에 실패했습니다."));
    } finally {
      setIsUploading(false);
    }
  };

  const handleTemplateDelete = async (id: string) => {
    try {
      await api.deleteReportTemplate(id);
      if (templateId === id) setTemplateId('');
      await loadTemplates();
    } catch {
      // ignore
    }
  };

  if (aiAvailable === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title={t("AI 리포트")} subtitle={currentProject?.name} backTo="/" showProjectSelector={false} />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {!aiAvailable && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg border border-yellow-200 dark:border-yellow-800">{t("AI 서비스가 설정되지 않았습니다. 서버 환경변수(AZURE_OPENAI_*)를 확인해주세요.")}</div>
        )}

        {/* Controls */}
        <div className="bg-card rounded-lg border p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Period */}
            <div className="space-y-2">
              <Label>{t("기간 유형")}</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as 'weekly' | 'monthly')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t("주간")}</SelectItem>
                  <SelectItem value="monthly">{t("월간")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label>{t("시작일")}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>{t("종료일")}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            {/* Template */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("양식 템플릿")}</Label>
                <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                      <Settings2 className="h-3 w-3 mr-1" />{t("관리")}</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{t("리포트 양식 관리")}</DialogTitle>
                    </DialogHeader>
                    <TemplateManager
                      templates={templates}
                      onUpload={handleTemplateUpload}
                      onDelete={handleTemplateDelete}
                      isUploading={isUploading}
                      name={newTemplateName}
                      onNameChange={setNewTemplateName}
                      desc={newTemplateDesc}
                      onDescChange={setNewTemplateDesc}
                      file={newTemplateFile}
                      onFileChange={setNewTemplateFile}
                    />
                  </DialogContent>
                </Dialog>
              </div>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("자유 형식")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("자유 형식")}</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !aiAvailable || !currentProject}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("리포트 생성 중...")}</>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />{t("리포트 생성")}</>
            )}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
        )}

        {/* Report Result */}
        {report && (
          <div className="bg-card rounded-lg border">
            {/* Report header */}
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="text-sm text-muted-foreground">
                {metadata && (
                  <span>
                    {t("{{period}} 리포트 ({{start}} ~ {{end}}) | 활동 {{logs}}건, 목표 {{goals}}개", { period: t(metadata.period), start: metadata.startDate, end: metadata.endDate, logs: metadata.logCount, goals: metadata.goalCount })}</span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />{t("복사됨")}</>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />{t("복사")}</>
                )}
              </Button>
            </div>

            {/* Report content - rendered as markdown-like prose */}
            <div className="px-5 py-4 max-w-none text-sm leading-relaxed">
              <MarkdownRenderer content={report} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple markdown renderer (handles headings, bold, lists, etc.)
function MarkdownRenderer({ content }: { content: string }) {
  useTranslation();
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(<ul key={`list-${listKey}`} className="list-disc pl-5 my-2 space-y-1">{listItems}</ul>);
      listItems = [];
      inList = false;
      listKey++;
    }
  };

  const renderInline = (text: string) => {
    // Bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={i} className="text-base font-semibold mt-4 mb-2">{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(<h2 key={i} className="text-lg font-bold mt-5 mb-2">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      flushList();
      elements.push(<h1 key={i} className="text-xl font-bold mt-6 mb-3">{renderInline(line.slice(2))}</h1>);
    }
    // Unordered list
    else if (line.match(/^\s*[-*]\s/)) {
      inList = true;
      listItems.push(<li key={i}>{renderInline(line.replace(/^\s*[-*]\s/, ''))}</li>);
    }
    // Ordered list
    else if (line.match(/^\s*\d+\.\s/)) {
      inList = true;
      listItems.push(<li key={i}>{renderInline(line.replace(/^\s*\d+\.\s/, ''))}</li>);
    }
    // Horizontal rule
    else if (line.match(/^---+$/)) {
      flushList();
      elements.push(<hr key={i} className="my-4" />);
    }
    // Empty line
    else if (line.trim() === '') {
      flushList();
    }
    // Normal paragraph
    else {
      flushList();
      elements.push(<p key={i} className="my-1">{renderInline(line)}</p>);
    }
  }
  flushList();

  return <>{elements}</>;
}

// Template management component
interface TemplateManagerProps {
  templates: ReportTemplate[];
  onUpload: () => void;
  onDelete: (id: string) => void;
  isUploading: boolean;
  name: string;
  onNameChange: (v: string) => void;
  desc: string;
  onDescChange: (v: string) => void;
  file: File | null;
  onFileChange: (f: File | null) => void;
}

function TemplateManager({
  templates,
  onUpload,
  onDelete,
  isUploading,
  name,
  onNameChange,
  desc,
  onDescChange,
  file,
  onFileChange,
}: TemplateManagerProps) {
  useTranslation();
  return (
    <div className="space-y-4">
      {/* Existing templates */}
      {templates.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("등록된 양식")}</Label>
          {templates.map((template) => (
            <div key={template.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{template.name}</p>
                {template.description && (
                  <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                )}
                {template.originalFileName && (
                  <p className="text-xs text-muted-foreground">
                    <FileText className="h-3 w-3 inline mr-1" />
                    {template.originalFileName}
                  </p>
                )}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("양식 삭제")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("'{{name}}' 양식을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.", { name: template.name })}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("취소")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(template.id)}>{t("삭제")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      {/* Upload new template */}
      <div className="space-y-3 pt-2 border-t">
        <Label className="text-sm font-medium">{t("새 양식 추가")}</Label>
        <Input
          placeholder={t("양식 이름 *")}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        <Textarea
          placeholder={t("설명 (선택사항)")}
          value={desc}
          onChange={(e) => onDescChange(e.target.value)}
          rows={2}
        />
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept=".pdf"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            className="flex-1"
          />
        </div>
        <Button
          onClick={onUpload}
          disabled={!name || !file || isUploading}
          className="w-full"
          size="sm"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("업로드 중...")}</>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />{t("양식 업로드")}</>
          )}
        </Button>
      </div>
    </div>
  );
}
