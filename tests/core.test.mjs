import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCTS, PRICE_MODES, AXES, STYLES, FOODS, BUDGETS, RESULT_CAPTION, STAFF_NOTE, STATUS_LABEL,
  byId, priceOf, formatWon, customerProducts, filterProducts, isCandidate, scoreProduct, recommend,
  radarPoints, tasteList, staffInventory, createQuizState, quizReducer, quizQuery, tagsOf, modeLabel,
} from '../core.mjs';

const ids = (r) => r.items.map((i) => i.product.id);
const scores = (r) => r.items.map((i) => i.score);

test('고정 가상 데이터 A-F가 실행 문서와 정확히 일치', () => {
  const expect = {
    A: ['맑은 결', 90000, 65000, 'crisp', 'seafood', [2, 4, 3, 2, 2, 3], 4, 'selling'],
    B: ['깊은 결', 120000, 85000, 'rich', 'grill', [2, 4, 2, 5, 5, 2], 3, 'selling'],
    C: ['꽃의 결', 100000, 70000, 'fragrant', 'seafood', [4, 2, 3, 2, 2, 5], 2, 'selling'],
    D: ['부드러운 결', 80000, 55000, 'crisp', 'grill', [3, 3, 2, 3, 3, 3], 5, 'selling'],
    E: ['계절의 결', 110000, 80000, 'fragrant', 'seafood', [4, 2, 3, 3, 3, 4], 0, 'soldout'],
    F: ['숨은 결', 130000, 95000, 'rich', 'grill', [2, 5, 2, 4, 4, 2], 2, 'hidden'],
  };
  assert.equal(PRODUCTS.length, 6);
  for (const [id, [short, store, retail, style, food, taste, stock, status]] of Object.entries(expect)) {
    const p = byId(id);
    assert.equal(p.name, `가상 사케 ${id} · ${short}`);
    assert.deepEqual([p.prices.store, p.prices.retail, p.style, p.food, p.taste, p.stock, p.status], [store, retail, style, food, taste, stock, status]);
  }
  assert.deepEqual(AXES, ['단맛', '드라이', '산미', '감칠맛', '바디', '향']);
  assert.deepEqual(PRICE_MODES.map((m) => m.label), ['매장가', '소매가']);
  assert.deepEqual(STYLES.map((s) => s.label), ['산뜻', '묵직', '향긋', '상관없음']);
  assert.deepEqual(FOODS.map((s) => s.label), ['해산물', '구이', '상관없음']);
  assert.deepEqual(BUDGETS, [50000, 70000, 100000, 150000]);
  assert.equal(RESULT_CAPTION, '가상 상품·가격 · 규칙 기반 추천 예시 · 실제 구매 불가');
  assert.equal(STAFF_NOTE, '시연용 가격 모드 · 직원 인증 미구현');
  assert.deepEqual(tagsOf(byId('A')), ['산뜻', '해산물']);
  assert.ok(Object.isFrozen(PRODUCTS));
});

test('가격은 한 모드씩만 읽고, 원화 포맷은 줄바꿈 없는 한 값', () => {
  assert.equal(priceOf(byId('A'), 'store'), 90000);
  assert.equal(priceOf(byId('A'), 'retail'), 65000);
  assert.throws(() => priceOf(byId('A'), 'wholesale'));
  assert.equal(formatWon(90000), '90,000원');
  assert.equal(formatWon(130000), '130,000원');
  assert.equal(modeLabel('store'), '매장가'); assert.equal(modeLabel('retail'), '소매가');
});

test('고객 컬렉션은 A-E 5종, F 비노출, E 포함(품절)', () => {
  const list = customerProducts();
  assert.deepEqual(list.map((p) => p.id), ['A', 'B', 'C', 'D', 'E']);
  assert.ok(!list.some((p) => p.id === 'F'));
  assert.equal(STATUS_LABEL[byId('E').status], '품절');
});

test('검색은 이름·ID·태그만, 대소문자/공백 무시, 필터와 결합, F는 절대 미노출', () => {
  assert.deepEqual(filterProducts({ query: '산뜻' }).map((p) => p.id), ['A', 'D']);
  assert.deepEqual(filterProducts({ query: ' 구이 ' }).map((p) => p.id), ['B', 'D']);
  assert.deepEqual(filterProducts({ query: '숨은' }).map((p) => p.id), []);
  assert.deepEqual(filterProducts({ query: 'f' }).map((p) => p.id), []);
  assert.deepEqual(filterProducts({ query: 'c' }).map((p) => p.id), ['C']);
  assert.deepEqual(filterProducts({ style: 'fragrant' }).map((p) => p.id), ['C', 'E']);
  assert.deepEqual(filterProducts({ style: 'rich', food: 'grill' }).map((p) => p.id), ['B']);
  assert.deepEqual(filterProducts({ query: '결', style: 'crisp', food: 'seafood' }).map((p) => p.id), ['A']);
  assert.deepEqual(filterProducts().map((p) => p.id), ['A', 'B', 'C', 'D', 'E']);
});

test('후보 조건: 판매중 AND 재고>0 AND 모드가격<=예산', () => {
  assert.ok(isCandidate(byId('A'), 'store', 90000));
  assert.ok(!isCandidate(byId('A'), 'store', 89999));
  assert.ok(isCandidate(byId('A'), 'retail', 65000));
  assert.ok(!isCandidate(byId('E'), 'store', 999999), 'E 재고 0·품절');
  assert.ok(!isCandidate(byId('F'), 'store', 999999), 'F 비노출');
  assert.ok(!isCandidate(byId('F'), 'retail', 999999));
});

test('점수: 스타일 +3, 음식 +2, 상관없음 0, 이유 태그는 일치 항목만', () => {
  assert.deepEqual(scoreProduct(byId('A'), { style: 'crisp', food: 'seafood' }), { score: 5, reasons: ['스타일 산뜻 일치 +3', '음식 해산물 일치 +2'] });
  assert.deepEqual(scoreProduct(byId('D'), { style: 'crisp', food: 'seafood' }), { score: 3, reasons: ['스타일 산뜻 일치 +3'] });
  assert.deepEqual(scoreProduct(byId('C'), { style: 'crisp', food: 'seafood' }), { score: 2, reasons: ['음식 해산물 일치 +2'] });
  assert.deepEqual(scoreProduct(byId('B'), { style: 'any', food: 'any' }), { score: 0, reasons: [] });
  assert.deepEqual(scoreProduct(byId('B'), { style: 'crisp', food: 'seafood' }), { score: 0, reasons: [] });
});

test('검증 예 1: 매장/100000/산뜻/해산물 → A5, D3, C2', () => {
  const r = recommend({ mode: 'store', budget: 100000, style: 'crisp', food: 'seafood' });
  assert.equal(r.kind, 'match');
  assert.deepEqual(ids(r), ['A', 'D', 'C']); assert.deepEqual(scores(r), [5, 3, 2]);
  assert.equal(r.count, 3); assert.equal(r.title, '조건에 맞는 상품 3개');
  assert.deepEqual(r.items.map((i) => i.price), [90000, 80000, 100000]);
});

test('검증 예 2: 소매/70000/향긋/해산물 → C5, A2 두 개만, D(0) 제외', () => {
  const r = recommend({ mode: 'retail', budget: 70000, style: 'fragrant', food: 'seafood' });
  assert.deepEqual(ids(r), ['C', 'A']); assert.deepEqual(scores(r), [5, 2]);
  assert.equal(r.count, 2); assert.equal(r.title, '조건에 맞는 상품 2개');
  assert.deepEqual(r.items.map((i) => i.price), [70000, 65000]);
  assert.deepEqual(r.items[1].reasons, ['음식 해산물 일치 +2']);
});

test('검증 예 3: 매장/100000/상관없음/상관없음 → 예산 안의 상품 A, C, D (취향 주장 없음)', () => {
  const r = recommend({ mode: 'store', budget: 100000, style: 'any', food: 'any' });
  assert.equal(r.kind, 'budget'); assert.deepEqual(ids(r), ['A', 'C', 'D']);
  assert.equal(r.title, '예산 안의 상품 3개');
  for (const i of r.items) { assert.equal(i.score, 0); assert.ok(!i.reasons.join().includes('일치')); }
});

test('한쪽만 지정해도 점수0 제외: 매장/150000/상관없음/구이 → B, D', () => {
  const r = recommend({ mode: 'store', budget: 150000, style: 'any', food: 'grill' });
  assert.deepEqual(ids(r), ['B', 'D']); assert.deepEqual(scores(r), [2, 2]);
  const r2 = recommend({ mode: 'store', budget: 150000, style: 'crisp', food: 'any' });
  assert.deepEqual(ids(r2), ['A', 'D']);
});

test('동점은 ID 오름차순, 상위 최대 3개: 매장/150000/상관없음/상관없음 → A,B,C', () => {
  const r = recommend({ mode: 'store', budget: 150000, style: 'any', food: 'any' });
  assert.deepEqual(ids(r), ['A', 'B', 'C']); assert.equal(r.count, 3);
  const r2 = recommend({ mode: 'retail', budget: 150000, style: 'any', food: 'seafood' });
  assert.deepEqual(ids(r2), ['A', 'C'], 'E는 품절이라 해산물 일치여도 제외');
});

test('E·F는 어떤 모드·예산·취향에서도 추천되지 않음', () => {
  for (const mode of ['store', 'retail']) for (const budget of [50000, 70000, 100000, 150000, 1000000])
    for (const style of ['crisp', 'rich', 'fragrant', 'any']) for (const food of ['seafood', 'grill', 'any']) {
      const got = ids(recommend({ mode, budget, style, food }));
      assert.ok(!got.includes('E') && !got.includes('F'), `${mode}/${budget}/${style}/${food} → ${got}`);
      assert.ok(got.length <= 3);
    }
});

test('예산 50000은 두 모드 모두 빈 결과 + 조건 다시 선택 안내', () => {
  for (const mode of ['store', 'retail']) {
    const r = recommend({ mode, budget: 50000, style: 'crisp', food: 'seafood' });
    assert.equal(r.kind, 'empty'); assert.equal(r.count, 0); assert.equal(r.title, '조건에 맞는 상품이 없습니다');
  }
  assert.equal(recommend({ mode: 'store', budget: null }).kind, 'empty');
});

test('모드 전환 시 같은 조건이 다른 결과로 재계산됨(캐시 없음)', () => {
  const q = { budget: 70000, style: 'fragrant', food: 'seafood' };
  assert.deepEqual(ids(recommend({ ...q, mode: 'store' })), []);
  assert.deepEqual(ids(recommend({ ...q, mode: 'retail' })), ['C', 'A']);
  const q2 = { budget: 100000, style: 'any', food: 'any' };
  assert.deepEqual(ids(recommend({ ...q2, mode: 'store' })), ['A', 'C', 'D']);
  assert.deepEqual(ids(recommend({ ...q2, mode: 'retail' })), ['A', 'B', 'C']);
});

test('추천 가격은 선택 모드 하나의 값', () => {
  const s = recommend({ mode: 'store', budget: 150000, style: 'rich', food: 'grill' });
  assert.deepEqual(ids(s), ['B', 'D'], 'D는 구이 +2로 포함, F는 비노출'); assert.deepEqual(scores(s), [5, 2]);
  assert.equal(s.items[0].price, 120000);
  const r = recommend({ mode: 'retail', budget: 150000, style: 'rich', food: 'grill' });
  assert.equal(r.items[0].price, 85000);
});

test('레이더 좌표: 6점, 12시부터 시계방향, 값 비례, 범위 검증', () => {
  const pts = radarPoints([5, 5, 5, 5, 5, 5], 200);
  assert.equal(pts.length, 6);
  assert.deepEqual(pts[0], [100, 22]);
  assert.ok(Math.abs(pts[3][0] - 100) < 0.01 && Math.abs(pts[3][1] - 178) < 0.01);
  const half = radarPoints([1, 1, 1, 1, 1, 1], 200);
  assert.ok(Math.abs(half[0][1] - (100 - 78 / 5)) < 0.01);
  assert.throws(() => radarPoints([1, 2, 3], 200));
  assert.throws(() => radarPoints([0, 2, 3, 4, 5, 5], 200));
  assert.throws(() => radarPoints([6, 2, 3, 4, 5, 5], 200));
  for (const p of PRODUCTS) assert.doesNotThrow(() => radarPoints(p.taste));
});

test('맛 텍스트 대안값은 데이터와 축 순서가 동일', () => {
  assert.deepEqual(tasteList(byId('B').taste), [
    { axis: '단맛', value: 2 }, { axis: '드라이', value: 4 }, { axis: '산미', value: 2 },
    { axis: '감칠맛', value: 5 }, { axis: '바디', value: 5 }, { axis: '향', value: 2 }]);
});

test('직원 개념 패널: 6종 전부(F 포함), 상태 라벨, 모드 가격 하나', () => {
  const s = staffInventory('store');
  assert.deepEqual(s.map((r) => r.id), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(s.map((r) => r.status), ['판매중', '판매중', '판매중', '판매중', '품절', '비노출']);
  assert.equal(s[5].price, 130000); assert.equal(staffInventory('retail')[5].price, 95000);
  assert.equal(s[4].stock, 0);
  assert.ok(!('prices' in s[0]));
});

test('퀴즈 상태: 선택 없이 다음 불가, 뒤로/처음부터, 선택 유지, 결과 단계', () => {
  let s = createQuizState();
  assert.equal(s.step, 0);
  s = quizReducer(s, { type: 'next' }); assert.equal(s.step, 0); assert.equal(s.error, '항목을 하나 선택해 주세요.');
  s = quizReducer(s, { type: 'set', field: 'budget', value: 100000 }); assert.equal(s.error, '');
  s = quizReducer(s, { type: 'next' }); assert.equal(s.step, 1);
  s = quizReducer(s, { type: 'set', field: 'style', value: 'crisp' });
  s = quizReducer(s, { type: 'next' }); assert.equal(s.step, 2);
  s = quizReducer(s, { type: 'back' }); assert.equal(s.step, 1); assert.equal(s.style, 'crisp');
  s = quizReducer(s, { type: 'next' });
  s = quizReducer(s, { type: 'set', field: 'food', value: 'seafood' });
  s = quizReducer(s, { type: 'next' }); assert.equal(s.step, 3);
  s = quizReducer(s, { type: 'next' }); assert.equal(s.step, 3);
  assert.deepEqual(quizQuery(s, 'store'), { mode: 'store', budget: 100000, style: 'crisp', food: 'seafood' });
  assert.deepEqual(ids(recommend(quizQuery(s, 'store'))), ['A', 'D', 'C']);
  assert.deepEqual(ids(recommend(quizQuery(s, 'retail'))), ['A', 'D', 'C'], '소매 100000: A65k D55k C70k 모두 후보');
  s = quizReducer(s, { type: 'goto', step: 2 }); assert.equal(s.step, 2); assert.equal(s.budget, 100000);
  s = quizReducer(s, { type: 'goto', step: 9 }); assert.equal(s.step, 3);
  s = quizReducer(s, { type: 'reset' }); assert.deepEqual(s, createQuizState());
  assert.equal(quizReducer(createQuizState(), { type: 'back' }).step, 0);
  assert.deepEqual(quizQuery(createQuizState(), 'store'), { mode: 'store', budget: null, style: 'any', food: 'any' });
});
