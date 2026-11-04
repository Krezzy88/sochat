import { expect, it } from 'vitest';
import { parseMessage, extractAmounts, fold, moneyProfile } from './index.ts';
const now = '2026-11-03T12:00:00+07:00';
it.each([
  ['2 cành', 200000],
  ['2 xị', 200000],
  ['7 loét', 700000],
  ['8 loét rưỡi', 850000],
  ['1 lít 8', 180000],
  ['1 lít 2', 120000],
  ['6 chục', 60000],
])('uses owner-approved money %s', (text, amount) => {
  expect(extractAmounts(fold(text), 'owner-confirmed-v1')[0]?.value).toBe(
    amount,
  );
});
it('keeps standard ambiguous slang and rejects unknown deployment profiles', () => {
  expect(parseMessage('ăn 2 lít', now).needs_clarification).toBe(true);
  expect(() => moneyProfile('guess')).toThrow();
});
it.each(['mua 2 lít xăng', 'mua 2 cành hoa', 'mua 2 chục trứng'])(
  'does not treat quantities as money: %s',
  (text) => {
    expect(extractAmounts(fold(text), 'owner-confirmed-v1')).toHaveLength(0);
    expect(
      parseMessage(text, now, 'owner-confirmed-v1').needs_clarification,
    ).toBe(true);
  },
);
it('resolves approved abbreviations, shipping segmentation and dates without guessing unitless amounts', () => {
  const gas = parseMessage('hqua đx 50', now, 'owner-confirmed-v1');
  expect(gas.items[0]).toMatchObject({
    category: 'di_chuyen',
    amount_vnd: null,
    occurred_on: '2026-11-02',
  });
  expect(gas.needs_clarification).toBe(true);
  const meal = parseMessage(
    'đặt gà rán 89k phí ship 18k',
    now,
    'owner-confirmed-v1',
  );
  expect(meal.items.map((i) => [i.category, i.amount_vnd])).toEqual([
    ['an_uong', 89000],
    ['di_chuyen', 18000],
  ]);
  expect(meal.needs_clarification).toBe(false);
});

it('does not mistake keyboard phím for cinema phim', () => {
  expect(
    parseMessage('mua bàn phím cơ hết 8 loét rưỡi', now, 'owner-confirmed-v1')
      .items[0],
  ).toMatchObject({ category: 'mua_sam', amount_vnd: 850000 });
});

it('flags unresolved bare money even beside an explicit money mention', () => {
  const result = parseMessage('phở 35k nước mía 15', now, 'owner-confirmed-v1');
  expect(result.needs_clarification).toBe(true);
  expect(result.reasons).toContain('bare_small_number');
});

it.each([
  ['phở 1', 1000],
  ['phở 10', 10000],
  ['phở 100', 100000],
  ['phở 999', 999000],
  ['phở 1000', 1000],
  ['phở 1.000', 1000],
  ['phở 35k', 35000],
])('applies newly approved bare-number profile to %s', (text, amount) => {
  const result = parseMessage(text, now, 'owner-confirmed-v2');
  expect(result.items[0]?.amount_vnd).toBe(amount);
  expect(result.needs_clarification).toBe(false);
});
it('excludes quantities and calendar noise from the newly approved scaling', () => {
  const result = parseMessage(
    'ngày 3 tháng 11 mua 2 ly cà phê 35',
    now,
    'owner-confirmed-v2',
  );
  expect(result.items).toHaveLength(1);
  expect(result.items[0]?.amount_vnd).toBe(35000);
  expect(
    parseMessage('phở 0', now, 'owner-confirmed-v2').needs_clarification,
  ).toBe(true);
  expect(
    parseMessage('phở -35', now, 'owner-confirmed-v2').needs_clarification,
  ).toBe(true);
});

it.each(['mua 2 gói mì 25', 'mua 2 áo 100k', 'mua 3 hộp sữa 50k'])(
  'does not convert purchase quantities into extra transactions: %s',
  (text) => {
    const result = parseMessage(text, now, 'owner-confirmed-v2');
    expect(result.items).toHaveLength(1);
    expect(result.needs_clarification).toBe(false);
    expect(result.items[0]?.amount_vnd).toBe(
      text.includes('25') ? 25000 : text.includes('100k') ? 100000 : 50000,
    );
  },
);
