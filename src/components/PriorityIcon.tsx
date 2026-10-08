import { GoalSize } from '@/types/goal';
import { ChevronsUp, ChevronUp, Minus, ChevronDown, ChevronsDown } from 'lucide-react';
import { getPriorityColor, getPriorityLabel, getPriorityIconType } from '@/lib/priorityColors';
import { cn } from '@/lib/utils';

interface PriorityIconProps {
  size: GoalSize;
  className?: string;
  showLabel?: boolean;
}

/**
 * JIRA 스타일 중요도 아이콘
 */
export const PriorityIcon = ({ size, className, showLabel = false }: PriorityIconProps) => {
  const color = getPriorityColor(size);
  const label = getPriorityLabel(size);
  const iconType = getPriorityIconType(size);

  const iconProps = {
    className: cn('w-4 h-4', className),
    style: { color },
    strokeWidth: 2.5,
  };

  const renderIcon = () => {
    switch (iconType) {
      case 'chevronsUp':
        return <ChevronsUp {...iconProps} />;
      case 'chevronUp':
        return <ChevronUp {...iconProps} />;
      case 'minus':
        return <Minus {...iconProps} />;
      case 'chevronDown':
        return <ChevronDown {...iconProps} />;
      case 'chevronsDown':
        return <ChevronsDown {...iconProps} />;
      default:
        return <Minus {...iconProps} />;
    }
  };

  if (showLabel) {
    return (
      <span className="inline-flex items-center gap-1" title={`중요도: ${label}`}>
        {renderIcon()}
        <span className="text-xs" style={{ color }}>{label}</span>
      </span>
    );
  }

  return (
    <span title={`중요도: ${label}`} className="inline-flex">
      {renderIcon()}
    </span>
  );
};
