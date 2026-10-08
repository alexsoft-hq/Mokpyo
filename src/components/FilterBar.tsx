import { t, useTranslation } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Filter, ChevronDown } from 'lucide-react';

interface FilterBarProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  selectedOwners: string[];
  onOwnerToggle: (owner: string) => void;
  owners: string[];
}

export const FilterBar = ({
  searchText,
  onSearchChange,
  selectedOwners,
  onOwnerToggle,
  owners,
}: FilterBarProps) => {
  useTranslation();
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">{t("필터")}</h3>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("목표 검색...")}
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-40 h-9 justify-between font-normal bg-background hover:bg-accent hover:text-accent-foreground"
            >
              <span className="text-sm truncate">
                {selectedOwners.length === 0
                  ? t("담당자 선택")
                  : t("{{value0}}명 선택", { value0: selectedOwners.length })}
              </span>
              <ChevronDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3">
            {owners.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                {t("담당자가 없습니다")}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2 pb-2 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => owners.forEach(owner => {
                      if (!selectedOwners.includes(owner)) {
                        onOwnerToggle(owner);
                      }
                    })}
                  >
                    {t("전체 선택")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => {
                      selectedOwners.forEach(owner => onOwnerToggle(owner));
                    }}
                  >
                    {t("전체 해제")}
                  </Button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {owners.map((owner) => (
                    <div
                      key={owner}
                      className="flex items-center space-x-3 px-2 py-1.5 rounded-md hover:bg-accent/20 cursor-pointer transition-colors"
                      onClick={() => onOwnerToggle(owner)}
                    >
                      <Checkbox
                        id={`owner-${owner}`}
                        checked={selectedOwners.includes(owner)}
                        className="!rounded-none pointer-events-none"
                      />
                      <label
                        htmlFor={`owner-${owner}`}
                        className="text-sm leading-none cursor-pointer flex-1 select-none"
                      >
                        {owner}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>

      </div>
    </div>
  );
};
