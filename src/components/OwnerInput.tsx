import { t, useTranslation } from '@/i18n';
import { useState, useMemo, useRef } from 'react';
import { User, Check, ChevronsUpDown, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarInfo } from '@/components/UserMenu';

export interface RegisteredUser {
  id: string;
  name: string;
  picture: string | null;
}

// --- OwnerAvatar ---
interface OwnerAvatarProps {
  ownerName: string;
  registeredUsers?: RegisteredUser[];
  size?: 'sm' | 'md';
}

export function OwnerAvatar({ ownerName, registeredUsers, size = 'sm' }: OwnerAvatarProps) {
  useTranslation();
  const matchedUser = registeredUsers?.find(u => u.name === ownerName);
  const avatarInfo = matchedUser ? getAvatarInfo(matchedUser.picture) : null;
  const sizeClass = size === 'sm' ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[10px]';

  if (!avatarInfo) {
    return <User className={sizeClass} />;
  }

  if (avatarInfo.type === 'default') {
    return (
      <span
        className={cn('inline-flex items-center justify-center rounded-full flex-shrink-0', sizeClass)}
        style={{ backgroundColor: (avatarInfo as any).bg }}
      >
        {(avatarInfo as any).emoji}
      </span>
    );
  }

  return (
    <Avatar className={cn(sizeClass, 'flex-shrink-0')}>
      <AvatarImage src={avatarInfo.url} alt={ownerName} />
      <AvatarFallback className="text-[8px]">{ownerName.charAt(0)}</AvatarFallback>
    </Avatar>
  );
}

// --- OwnerInput ---
interface OwnerInputProps {
  value: string;
  onChange: (value: string) => void;
  registeredUsers?: RegisteredUser[];
  existingOwners?: string[];
  className?: string;
  placeholder?: string;
}

export function OwnerInput({ value, onChange, registeredUsers = [], existingOwners = [], className, placeholder = t("담당자 이름") }: OwnerInputProps) {
  useTranslation();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Merge registered users and existing owners into suggestions
  const suggestions = useMemo(() => {
    const items: { name: string; picture: string | null; isRegistered: boolean }[] = [];
    const addedNames = new Set<string>();

    // Registered users first
    registeredUsers.forEach(u => {
      items.push({ name: u.name, picture: u.picture, isRegistered: true });
      addedNames.add(u.name);
    });

    // Existing owners that are not registered users
    existingOwners.forEach(name => {
      if (!addedNames.has(name)) {
        items.push({ name, picture: null, isRegistered: false });
        addedNames.add(name);
      }
    });

    return items;
  }, [registeredUsers, existingOwners]);

  const filteredSuggestions = useMemo(() => {
    if (!inputValue) return suggestions;
    const lower = inputValue.toLowerCase();
    return suggestions.filter(s => s.name.toLowerCase().includes(lower));
  }, [suggestions, inputValue]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground', className)}
        >
          <span className="flex items-center gap-2 truncate">
            {value ? (
              <>
                <OwnerAvatar ownerName={value} registeredUsers={registeredUsers} size="sm" />
                {value}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("이름 검색 또는 입력...")}
            value={inputValue}
            onValueChange={(v) => {
              // 복수 담당자 구분자(/, ,) 입력 차단
              if (/[/,]/.test(v)) return;
              setInputValue(v);
            }}
            onKeyDown={(e) => {
              // 한국어 IME 조합 확정 Enter 는 무시 (조합 중 커밋 방지)
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Enter' && inputValue && filteredSuggestions.length === 0) {
                onChange(inputValue.trim());
                setInputValue('');
                setOpen(false);
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue ? (
                <button
                  className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded cursor-pointer"
                  onClick={() => {
                    onChange(inputValue);
                    setInputValue('');
                    setOpen(false);
                  }}
                >
                  {t('"{{name}}" 사용', { name: inputValue })}
                </button>
              ) : (
                t("검색 결과 없음")
              )}
            </CommandEmpty>
            {filteredSuggestions.length > 0 && (
              <CommandGroup>
                {filteredSuggestions.map((item) => (
                  <CommandItem
                    key={item.name}
                    value={item.name}
                    onSelect={() => {
                      onChange(item.name);
                      setInputValue('');
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === item.name ? 'opacity-100' : 'opacity-0')} />
                    <OwnerAvatar ownerName={item.name} registeredUsers={registeredUsers} size="sm" />
                    <span className="ml-2">{item.name}</span>
                    {item.isRegistered && (
                      <span className="ml-auto text-xs text-muted-foreground">{t("등록 사용자")}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// --- MultiOwnerInput ---
interface MultiOwnerInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  registeredUsers?: RegisteredUser[];
  existingOwners?: string[];
  className?: string;
  placeholder?: string;
}

export function MultiOwnerInput({ values, onChange, registeredUsers = [], existingOwners = [], className, placeholder = t("담당자 추가") }: MultiOwnerInputProps) {
  useTranslation();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const suggestions = useMemo(() => {
    const items: { name: string; picture: string | null; isRegistered: boolean }[] = [];
    const addedNames = new Set<string>();

    registeredUsers.forEach(u => {
      items.push({ name: u.name, picture: u.picture, isRegistered: true });
      addedNames.add(u.name);
    });

    existingOwners.forEach(name => {
      if (!addedNames.has(name)) {
        items.push({ name, picture: null, isRegistered: false });
        addedNames.add(name);
      }
    });

    return items;
  }, [registeredUsers, existingOwners]);

  const filteredSuggestions = useMemo(() => {
    const lower = inputValue.toLowerCase();
    const filtered = inputValue
      ? suggestions.filter(s => s.name.toLowerCase().includes(lower))
      : suggestions;
    return filtered;
  }, [suggestions, inputValue]);

  const addOwner = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInputValue('');
  };

  const removeOwner = (name: string) => {
    onChange(values.filter(v => v !== name));
  };

  return (
    <div className={cn('space-y-2', className)}>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-md text-sm border border-primary/20"
            >
              <OwnerAvatar ownerName={name} registeredUsers={registeredUsers} size="sm" />
              {name}
              <button
                type="button"
                onClick={() => removeOwner(name)}
                className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal text-muted-foreground"
            size="sm"
          >
            <span className="flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              {placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("이름 검색 또는 입력...")}
              value={inputValue}
              onValueChange={(v) => {
                if (/[/,]/.test(v)) return;
                setInputValue(v);
              }}
              onKeyDown={(e) => {
                // 한국어 IME 조합 확정 Enter 는 무시 (조합 중 커밋 방지)
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter' && inputValue && filteredSuggestions.length === 0) {
                  addOwner(inputValue);
                }
              }}
            />
            <CommandList>
              <CommandEmpty>
                {inputValue ? (
                  <button
                    className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded cursor-pointer"
                    onClick={() => {
                      addOwner(inputValue);
                    }}
                  >
                    {t('"{{name}}" 추가', { name: inputValue })}
                  </button>
                ) : (
                  t("검색 결과 없음")
                )}
              </CommandEmpty>
              {filteredSuggestions.length > 0 && (
                <CommandGroup>
                  {filteredSuggestions.map((item) => (
                    <CommandItem
                      key={item.name}
                      value={item.name}
                      onSelect={() => {
                        if (values.includes(item.name)) {
                          removeOwner(item.name);
                        } else {
                          addOwner(item.name);
                        }
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', values.includes(item.name) ? 'opacity-100' : 'opacity-0')} />
                      <OwnerAvatar ownerName={item.name} registeredUsers={registeredUsers} size="sm" />
                      <span className="ml-2">{item.name}</span>
                      {item.isRegistered && (
                        <span className="ml-auto text-xs text-muted-foreground">{t("등록 사용자")}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
