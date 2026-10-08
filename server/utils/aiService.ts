/**
 * Azure OpenAI Service - REST API 직접 호출 (SDK 불필요)
 */
import axios from 'axios';

interface ChatCompletionOptions {
  maxTokens?: number;
  timeoutMs?: number;
}

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityTitle?: string | null;
  summary?: string | null;
  createdAt: Date | string;
}

interface GoalInfo {
  title: string;
  progress: number;
  owner: string;
  dueDate?: string | null;
  categories?: string[];
  subGoals?: Array<{ title: string; progress: number; owner: string }>;
}

export function isAIAvailable(): boolean {
  return !!(
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_API_KEY &&
    process.env.AZURE_OPENAI_API_VERSION &&
    process.env.AZURE_OPENAI_DEPLOYMENT
  );
}

export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options: ChatCompletionOptions = {}
): Promise<string> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
  const apiKey = process.env.AZURE_OPENAI_API_KEY!;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION!;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT!;

  const { maxTokens = 4096, timeoutMs = 120000 } = options ?? {};

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const response = await axios.post(
    url,
    {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: maxTokens,
      stream: false,
      reasoning_effort: 'low',
    },
    {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: timeoutMs,
    }
  );

  return response.data.choices?.[0]?.message?.content || '';
}

/**
 * 스트리밍 chatCompletion — SSE 청크를 콜백으로 전달
 */
export async function chatCompletionStream(
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void,
  options: ChatCompletionOptions = {}
): Promise<void> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
  const apiKey = process.env.AZURE_OPENAI_API_KEY!;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION!;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT!;

  const { maxTokens = 4096, timeoutMs = 180000 } = options ?? {};

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const response = await axios.post(
    url,
    {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: maxTokens,
      stream: true,
      reasoning_effort: 'low',
    },
    {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: timeoutMs,
      responseType: 'stream',
    }
  );

  return new Promise((resolve, reject) => {
    let buffer = '';
    response.data.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      // 마지막 줄은 아직 완성되지 않았을 수 있으므로 보관
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') continue;

        try {
          const json = JSON.parse(payload);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            onChunk(content);
          }
        } catch {
          // 파싱 불가 청크 무시
        }
      }
    });

    response.data.on('end', () => resolve());
    response.data.on('error', (err: Error) => reject(err));
  });
}

/**
 * AuditLog 목록을 AI 프롬프트에 적합한 텍스트로 압축
 */
export function compressAuditLogs(logs: AuditLogEntry[]): string {
  if (logs.length === 0) return '(활동 내역 없음)';

  if (logs.length <= 100) {
    return logs
      .map((log) => {
        const date = new Date(log.createdAt).toLocaleDateString('ko-KR');
        const title = log.entityTitle ? ` "${log.entityTitle}"` : '';
        const summary = log.summary ? ` - ${log.summary}` : '';
        return `[${date}] ${log.action} ${log.entityType}${title}${summary}`;
      })
      .join('\n');
  }

  // 100개 초과: 그룹화하여 요약
  const groups: Record<string, { count: number; titles: string[] }> = {};
  for (const log of logs) {
    const key = `${log.entityType}_${log.action}`;
    if (!groups[key]) {
      groups[key] = { count: 0, titles: [] };
    }
    groups[key].count++;
    if (groups[key].titles.length < 3 && log.entityTitle) {
      groups[key].titles.push(log.entityTitle);
    }
  }

  return Object.entries(groups)
    .map(([key, { count, titles }]) => {
      const [entityType, action] = key.split('_');
      const examples = titles.length > 0 ? ` (예: ${titles.join(', ')})` : '';
      return `${entityType} ${action}: ${count}건${examples}`;
    })
    .join('\n');
}

/**
 * Goal 현재 상태를 AI 프롬프트용 텍스트로 변환
 */
export function formatGoalsForPrompt(goals: GoalInfo[]): string {
  if (goals.length === 0) return '(등록된 목표 없음)';

  return goals
    .map((g) => {
      const cats = g.categories?.length ? ` [${g.categories.join(', ')}]` : '';
      const due = g.dueDate ? `, 마감: ${g.dueDate}` : '';
      const subs =
        g.subGoals && g.subGoals.length > 0
          ? `\n  하위목표: ${g.subGoals.map((s) => `${s.title}(${s.progress}%)`).join(', ')}`
          : '';
      return `목표 "${g.title}" (진행률 ${g.progress}%, 담당: ${g.owner}${due})${cats}${subs}`;
    })
    .join('\n');
}
