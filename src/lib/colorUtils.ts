// 동적(사용자 지정) hex 색 위에 올릴 텍스트 색을 명도로 결정한다.
// 밝은 배경(시작 전 #94a3b8, 보류 #f59e0b 등)엔 어두운 글자, 어두운 배경엔 흰 글자.

/** #rgb / #rrggbb → {r,g,b} (0-255). 파싱 실패 시 회색. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return { r: 107, g: 114, b: 128 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** 상대 명도 (WCAG 근사). 0(검정)~1(흰색). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * 배경 hex 에 대해 판독 가능한 글자색(흰/어둠) 반환.
 * 임계값 0.32: 밝은 필(보류#f59e0b·완료#22c55e·시작전#94a3b8, L 0.36~0.44)엔 어두운 글자,
 * 진한 필(진행중#3b82f6·위험#ef4444, L 0.23~0.24)엔 흰 글자 — 대비·관례 모두 만족.
 * (기존 0.55 는 모든 시드색이 흰 글자로 떨어져 amber/green/slate 가독성 미달이었음)
 */
export function readableTextColor(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.32 ? '#1f2937' /* gray-800 */ : '#ffffff';
}
