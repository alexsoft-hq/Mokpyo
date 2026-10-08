import { Fragment } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getShortcutGroups } from '@/lib/shortcuts';

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 font-sans text-xs font-medium text-foreground">
      {children}
    </kbd>
  );
}

export interface ShortcutHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** ? 키로 여는 단축키 도움말. 목록은 src/lib/shortcuts.ts 한 곳에서 온다. */
export function ShortcutHelpDialog({ open, onOpenChange }: ShortcutHelpDialogProps) {
  const groups = getShortcutGroups();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>단축키</DialogTitle>
          <DialogDescription>
            입력 중이거나 다이얼로그가 열려 있을 때는 동작하지 않습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">{group.title}</h3>
              <ul className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-foreground">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key, i) => (
                        <Fragment key={key}>
                          {i > 0 && <span className="text-xs text-muted-foreground">다음</span>}
                          <Key>{key}</Key>
                        </Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
