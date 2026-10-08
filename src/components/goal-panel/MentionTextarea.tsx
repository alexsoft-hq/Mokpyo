import { t, useTranslation } from '@/i18n';
import { useState, useRef, useCallback } from 'react';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { OwnerAvatar, RegisteredUser } from '@/components/OwnerInput';
import { toMentionMarker } from '@/lib/mentions';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (v: string) => void;
  users: RegisteredUser[];
  placeholder?: string;
  onSubmit?: () => void;
  className?: string;
}

/**
 * @멘션 자동완성 textarea. OwnerInput 의 cmdk 패턴을 이식 — '@' 입력 시 팝업으로 멤버 검색,
 * 선택하면 본문에 @[이름](userId) 마커 삽입. IME 조합 Enter 는 커밋 무시.
 */
export function MentionTextarea({ value, onChange, users, placeholder = t("댓글 입력… @로 멤버 멘션"), onSubmit, className }: Props) {
  useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [triggerIdx, setTriggerIdx] = useState(-1);

  const detectMention = useCallback((text: string, caret: number) => {
    // 커서 앞에서 가장 가까운 '@' 를 찾고, 그 뒤가 공백 없는 토큰이면 멘션 검색
    const upto = text.slice(0, caret);
    const at = upto.lastIndexOf('@');
    if (at === -1) { setOpen(false); return; }
    const token = upto.slice(at + 1);
    if (/\s/.test(token)) { setOpen(false); return; }
    setTriggerIdx(at);
    setQuery(token);
    setOpen(true);
  }, []);

  const insertMention = (u: RegisteredUser) => {
    if (!u.id) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, triggerIdx);
    const after = value.slice(caret);
    const marker = toMentionMarker(u.name, u.id) + ' ';
    const next = before + marker + after;
    onChange(next);
    setOpen(false);
    setQuery('');
    requestAnimationFrame(() => {
      const pos = (before + marker).length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const filtered = users.filter((u) => u.id && u.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => { onChange(e.target.value); detectMention(e.target.value, e.target.selectionStart ?? 0); }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (open && filtered.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
            e.preventDefault();
            insertMention(filtered[0]);
            return;
          }
          if (e.key === 'Escape') setOpen(false);
          // Cmd/Ctrl+Enter 로 전송
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSubmit) { e.preventDefault(); onSubmit(); }
        }}
        placeholder={placeholder}
        rows={2}
        className={cn(
          'w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 bottom-full mb-1 w-56 rounded-md border bg-popover shadow-md">
          <Command>
            <CommandList>
              <CommandGroup heading={t("멤버 멘션")}>
                {filtered.map((u) => (
                  <CommandItem key={u.id} value={u.name} onSelect={() => insertMention(u)} className="flex items-center gap-2 cursor-pointer">
                    <OwnerAvatar ownerName={u.name} registeredUsers={users} size="sm" />
                    {u.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
