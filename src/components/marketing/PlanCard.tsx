import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Plan } from './plans';

interface PlanCardProps {
  plan: Plan;
  /** 랜딩의 요약 카드는 포함 항목을 앞의 몇 개만 보여준다. */
  maxFeatures?: number;
}

export function PlanCard({ plan, maxFeatures }: PlanCardProps) {
  const features = maxFeatures ? plan.features.slice(0, maxFeatures) : plan.features;
  const hidden = plan.features.length - features.length;

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md',
        plan.highlighted ? 'border-primary' : 'border-border',
      )}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">{plan.price}</span>
        <span className="text-sm text-muted-foreground">{plan.priceNote}</span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{plan.summary}</p>

      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-foreground">{feature}</span>
          </li>
        ))}
        {hidden > 0 && <li className="text-muted-foreground">외 {hidden}가지</li>}
      </ul>

      <Button
        asChild
        className="mt-6 w-full"
        variant={plan.highlighted ? 'default' : 'outline'}
      >
        <a href={plan.cta.href}>{plan.cta.label}</a>
      </Button>
    </div>
  );
}

export default PlanCard;
