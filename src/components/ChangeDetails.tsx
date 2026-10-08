import { ChangesData } from '@/types/activity';

interface ChangeDetailsProps {
  changes: ChangesData | string | undefined;
  compact?: boolean;
}

export const ChangeDetails = ({ changes, compact = false }: ChangeDetailsProps) => {
  if (!changes) return null;

  // 문자열인 경우 파싱 시도
  let changesData: ChangesData;
  if (typeof changes === 'string') {
    try {
      changesData = JSON.parse(changes);
    } catch {
      return null;
    }
  } else {
    changesData = changes;
  }

  // 변경 내용이 없으면 null 반환
  if (!changesData.fields && !changesData.categories && !changesData.subGoals && !changesData.notes) {
    return null;
  }

  return (
    <div className={`space-y-1 text-xs ${compact ? '' : 'mt-2'}`}>
      {/* 필드 변경 */}
      {changesData.fields?.map((field, idx) => (
        <div key={`field-${idx}`} className="flex items-center gap-1 text-muted-foreground flex-wrap">
          <span className="text-blue-500">~</span>
          <span>{field.fieldLabel}:</span>
          <span className="line-through text-muted-foreground/70">{String(field.oldValue)}</span>
          <span className="text-muted-foreground/50">→</span>
          <span className="font-medium text-foreground">{String(field.newValue)}</span>
        </div>
      ))}

      {/* 카테고리 변경 */}
      {changesData.categories?.added?.map((cat, idx) => (
        <div key={`cat-add-${idx}`} className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <span>+</span>
          <span>카테고리 추가: {cat}</span>
        </div>
      ))}
      {changesData.categories?.removed?.map((cat, idx) => (
        <div key={`cat-rm-${idx}`} className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <span>-</span>
          <span>카테고리 삭제: {cat}</span>
        </div>
      ))}

      {/* 하위 목표 변경 */}
      {changesData.subGoals?.added?.map((sg, idx) => (
        <div key={`sg-add-${idx}`} className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <span>+</span>
          <span>하위 목표 추가: {sg.title}</span>
        </div>
      ))}
      {changesData.subGoals?.updated?.map((sg, idx) => (
        <div key={`sg-upd-${idx}`} className="flex items-start gap-1 text-blue-600 dark:text-blue-400">
          <span>~</span>
          <div>
            <span>하위 목표 수정: {sg.title}</span>
            {sg.changes?.length > 0 && (
              <div className="ml-2 text-muted-foreground">
                {sg.changes.map((c, cIdx) => (
                  <span key={cIdx} className="mr-2">
                    {c.fieldLabel}: {String(c.oldValue)} → {String(c.newValue)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {changesData.subGoals?.deleted?.map((sg, idx) => (
        <div key={`sg-del-${idx}`} className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <span>-</span>
          <span>하위 목표 삭제: {sg.title}</span>
        </div>
      ))}

      {/* 메모 변경 */}
      {changesData.notes?.added?.map((note, idx) => (
        <div key={`note-add-${idx}`} className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <span>+</span>
          <span>메모 추가: "{note.content}"</span>
        </div>
      ))}
      {changesData.notes?.updated?.map((note, idx) => (
        <div key={`note-upd-${idx}`} className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <span>~</span>
          <span>메모 수정: "{note.contentPreview}"</span>
        </div>
      ))}
      {changesData.notes?.deleted?.map((note, idx) => (
        <div key={`note-del-${idx}`} className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <span>-</span>
          <span>메모 삭제: "{note.contentPreview}"</span>
        </div>
      ))}
    </div>
  );
};
