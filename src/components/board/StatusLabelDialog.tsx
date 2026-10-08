import { t, useTranslation } from '@/i18n';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StatusLabel } from '@/types/fields';

const PRESET_COLORS = ['#94a3b8', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#14b8a6', '#06b6d4'];

interface Props {
  open: boolean;
  onClose: () => void;
  // 편집이면 라벨, 신규면 null
  label: StatusLabel | null;
  onSubmit: (data: { name: string; color: string }) => Promise<void>;
}

/** 상태 라벨(칸반 컬럼) 추가·편집 다이얼로그. 시스템 라벨은 이름 변경 불가(서버가 400). */
export function StatusLabelDialog({ open, onClose, label, onSubmit }: Props) {
  useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[1]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(label?.name ?? '');
      setColor(label?.color ?? PRESET_COLORS[1]);
    }
  }, [open, label]);

  const isSystem = !!label?.isSystem;

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), color });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{label ? t("상태 편집") : t("상태 추가")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("이름")}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.nativeEvent.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); }}
              disabled={isSystem}
              placeholder={t("예: 검토 중")}
            />
            {isSystem && <p className="text-xs text-muted-foreground">{t("기본 상태는 이름을 변경할 수 없습니다(색상만 가능).")}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("색상")}</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn('w-7 h-7 rounded-full border-2', color === c ? 'border-foreground' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                  aria-label={t("색상 {{value0}}", { value0: c })}
                  aria-pressed={color === c}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("취소")}</Button>
          <Button onClick={submit} disabled={saving || !name.trim()}>{label ? t("저장") : t("추가")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
