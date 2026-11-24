// 결 · SAKE CURATION — 순수 규칙 모듈 (DOM 없음). 가상 상품·가상 가격, 실제 판매 없음.
export const PRICE_MODES = [
  { key: 'store', label: '매장가' },
  { key: 'retail', label: '소매가' },
];
export const AXES = ['단맛', '드라이', '산미', '감칠맛', '바디', '향'];
export const STYLES = [
  { key: 'crisp', label: '산뜻' },
  { key: 'rich', label: '묵직' },
  { key: 'fragrant', label: '향긋' },
  { key: 'any', label: '상관없음' },
];
export const FOODS = [
  { key: 'seafood', label: '해산물' },
  { key: 'grill', label: '구이' },
  { key: 'any', label: '상관없음' },
];
export const BUDGETS = [50000, 70000, 100000, 150000];
export const STATUS_LABEL = { selling: '판매중', soldout: '품절', hidden: '비노출' };
export const RESULT_CAPTION = '가상 상품·가격 · 규칙 기반 추천 예시 · 실제 구매 불가';
export const STAFF_NOTE = '시연용 가격 모드 · 직원 인증 미구현';

const P = (id, short, store, retail, style, food, taste, stock, status, hue) => ({
  id, short, name: `가상 사케 ${id} · ${short}`, prices: { store, retail },
  style, food, taste, stock, status, hue,
});
export const PRODUCTS = Object.freeze([
  P('A', '맑은 결', 90000, 65000, 'crisp', 'seafood', [2, 4, 3, 2, 2, 3], 4, 'selling', 150),
  P('B', '깊은 결', 120000, 85000, 'rich', 'grill', [2, 4, 2, 5, 5, 2], 3, 'selling', 24),
  P('C', '꽃의 결', 100000, 70000, 'fragrant', 'seafood', [4, 2, 3, 2, 2, 5], 2, 'selling', 340),
  P('D', '부드러운 결', 80000, 55000, 'crisp', 'grill', [3, 3, 2, 3, 3, 3], 5, 'selling', 42),
  P('E', '계절의 결', 110000, 80000, 'fragrant', 'seafood', [4, 2, 3, 3, 3, 4], 0, 'soldout', 200),
  P('F', '숨은 결', 130000, 95000, 'rich', 'grill', [2, 5, 2, 4, 4, 2], 2, 'hidden', 0),
]);

export const labelOf = (list, key) => (list.find((o) => o.key === key) || {}).label || key;
export const modeLabel = (mode) => labelOf(PRICE_MODES, mode);
export const priceOf = (product, mode) => {
  if (!(mode in product.prices)) throw new Error(`unknown price mode: ${mode}`);
  return product.prices[mode];
};
export const formatWon = (n) => `${n.toLocaleString('ko-KR')}원`;
export const tagsOf = (p) => [labelOf(STYLES, p.style), labelOf(FOODS, p.food)];
export const byId = (id) => PRODUCTS.find((p) => p.id === id) || null;

/** 고객 컬렉션: 비노출(F) 제외, 품절(E) 포함. */
export const customerProducts = () => PRODUCTS.filter((p) => p.status !== 'hidden');

/** 이름·태그 검색 + 스타일/음식 필터. 메모리 전용, 개인정보 아님. */
export function filterProducts({ query = '', style = 'any', food = 'any' } = {}) {
  const q = query.trim().toLowerCase();
  return customerProducts().filter((p) => {
    if (style !== 'any' && p.style !== style) return false;
    if (food !== 'any' && p.food !== food) return false;
    if (!q) return true;
    const hay = [p.name, p.id, ...tagsOf(p)].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

export const isCandidate = (p, mode, budget) =>
  p.status === 'selling' && p.stock > 0 && priceOf(p, mode) <= budget;

export function scoreProduct(p, { style = 'any', food = 'any' } = {}) {
  const reasons = [];
  let score = 0;
  if (style !== 'any' && p.style === style) { score += 3; reasons.push(`스타일 ${labelOf(STYLES, style)} 일치 +3`); }
  if (food !== 'any' && p.food === food) { score += 2; reasons.push(`음식 ${labelOf(FOODS, food)} 일치 +2`); }
  return { score, reasons };
}

/**
 * 추천: 후보 = 판매중 AND 재고>0 AND 선택모드가격<=예산.
 * 스타일/음식 중 하나라도 지정하면 점수0 제외. 동점 ID 오름차순, 최대 3개.
 * 둘 다 상관없음이면 '예산 안의 상품'(ID순 최대 3개, 취향 주장 없음).
 */
export function recommend({ mode = 'store', budget, style = 'any', food = 'any' }) {
  if (!Number.isFinite(budget)) return { kind: 'empty', items: [], count: 0, title: '예산을 선택해 주세요' };
  const pool = PRODUCTS.filter((p) => isCandidate(p, mode, budget));
  const tasteGiven = style !== 'any' || food !== 'any';
  let items;
  if (!tasteGiven) {
    items = pool.map((p) => ({ product: p, score: 0, reasons: [`예산 ${formatWon(budget)} 안의 상품`] }));
  } else {
    items = pool
      .map((p) => ({ product: p, ...scoreProduct(p, { style, food }) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || (a.product.id < b.product.id ? -1 : 1));
  }
  items = items.slice(0, 3).map((r) => ({ ...r, price: priceOf(r.product, mode) }));
  const count = items.length;
  if (count === 0) return { kind: 'empty', items, count, title: '조건에 맞는 상품이 없습니다' };
  return tasteGiven
    ? { kind: 'match', items, count, title: `조건에 맞는 상품 ${count}개` }
    : { kind: 'budget', items, count, title: `예산 안의 상품 ${count}개` };
}

/** 6축 레이더 좌표. 값 1..5 → 반지름 비율, 12시 방향부터 시계방향. */
export function radarPoints(taste, size = 200, pad = 22) {
  if (taste.length !== 6) throw new Error('taste must have 6 axes');
  const c = size / 2, r = c - pad;
  return taste.map((v, i) => {
    if (!Number.isInteger(v) || v < 1 || v > 5) throw new Error(`axis ${i} out of range`);
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [+(c + Math.cos(a) * r * (v / 5)).toFixed(2), +(c + Math.sin(a) * r * (v / 5)).toFixed(2)];
  });
}
export const tasteList = (taste) => AXES.map((axis, i) => ({ axis, value: taste[i] }));

/** 직원 개념 패널: 비노출 F 포함 전체 6종, 선택 모드 가격만. 읽기 전용. */
export const staffInventory = (mode) => PRODUCTS.map((p) => ({
  id: p.id, name: p.name, price: priceOf(p, mode), stock: p.stock, status: STATUS_LABEL[p.status],
}));

// ---- 퀴즈 상태 (클라이언트 메모리 전용) ----
export const QUIZ_STEPS = ['budget', 'style', 'food'];
export const createQuizState = () => ({ step: 0, budget: null, style: null, food: null, error: '' });

export function quizReducer(state, action) {
  const s = { ...state, error: '' };
  switch (action.type) {
    case 'set': return { ...s, [action.field]: action.value };
    case 'next': {
      const field = QUIZ_STEPS[s.step];
      if (s.step < 3 && s[field] == null) return { ...s, error: '항목을 하나 선택해 주세요.' };
      return { ...s, step: Math.min(3, s.step + 1) };
    }
    case 'back': return { ...s, step: Math.max(0, s.step - 1) };
    case 'goto': return { ...s, step: Math.max(0, Math.min(3, action.step)) };
    case 'reset': return createQuizState();
    default: return s;
  }
}
export const quizQuery = (q, mode) => ({ mode, budget: q.budget, style: q.style ?? 'any', food: q.food ?? 'any' });
