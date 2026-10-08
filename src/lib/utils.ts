import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { SubGoal } from "@/types/goal";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---- Key Result (정량 지표) helpers ----
// KR 하위목표는 targetValue가 있고 startValue와 값이 다를 때 자동 진행률로 계산된다.
type KrFields = Pick<SubGoal, "targetValue" | "currentValue" | "startValue" | "progress">;

export function isKeyResult(sg: Pick<SubGoal, "targetValue" | "startValue">): boolean {
  return sg.targetValue != null && sg.startValue !== sg.targetValue;
}

export function computeKrProgress(sg: KrFields): number {
  const start = sg.startValue ?? 0;
  const target = sg.targetValue ?? 0;
  const current = sg.currentValue ?? 0;
  if (target === start) return sg.progress ?? 0;
  const pct = ((current - start) / (target - start)) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}
