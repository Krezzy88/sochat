import type {
  Classification,
  ExpenseCategory,
  IncomeCategory,
} from './types.ts';

const INCOME_RULES: readonly (readonly [IncomeCategory, RegExp])[] = [
  ['luong', /\b(luong)\b/],
  ['tro_cap', /\b(me|ba|bo|gia dinh|ba me)\s+(gui|cho|chuyen)\b|\btro cap\b/],
  ['lam_them', /\blam them\b|\bfreelance\b/],
  ['thu_khac', /\b(nhan|duoc cho|thuong|hoan tien|tien lai)\b/],
];
const EXPENSE_RULES: readonly (readonly [ExpenseCategory, RegExp])[] = [
  // priority order matters: multi-word and specific rules first
  [
    'hoa_don',
    /\btien (dien|nuoc|mang|wifi|internet)\b|\bwifi\b|\binternet\b|\bnap (dien thoai|tien dien thoai)\b|\bcuoc (dien thoai|mang)\b/,
  ],
  ['nha_tro', /\b(tien tro|tien nha|thue phong|phong tro|thue nha)\b/],
  [
    'hoc_tap',
    /\b(hoc phi|sach|photo|in tai lieu|khoa hoc|ielts|toeic|le phi thi|hoc them|van phong pham)\b/,
  ],
  [
    'di_chuyen',
    /\b(xang|do xang|grab|taxi|xe bus|xe buyt|gui xe|ve xe|di xe|be bike|xanh sm)\b/,
  ],
  ['suc_khoe', /\b(thuoc|kham benh|bac si|nha khoa|gym|phong gym|vitamin)\b/],
  [
    'giai_tri',
    /\b(xem phim|ve phim|phim|game|netflix|spotify|karaoke|cafe game|nap game)\b/,
  ],
  [
    'an_uong',
    /\b(pho|bun|com|banh mi|an|uong|ca phe|cafe|tra sua|tra dao|nuoc mia|do an|nhau|bia|lau|bbq|an sang|an trua|an toi)\b/,
  ],
  ['mua_sam', /\b(mua|ao|quan|giay|dep|shopee|lazada|do dung|my pham|tui)\b/],
];
export function classify(
  foldedSegment: string,
  ownerProfile = false,
): Classification {
  for (const [cat, re] of INCOME_RULES)
    if (re.test(foldedSegment)) return { type: 'income', category: cat };
  if (ownerProfile) {
    const extra: readonly (readonly [ExpenseCategory, RegExp])[] = [
      ['mua_sam', /\b(ban phim|tai nghe|op lung)\b/],
      ['hoa_don', /\b(giat do|nap dien thoai)\b/],
      ['di_chuyen', /\b(ship|phi van chuyen|phi giao hang)\b/],
      ['hoc_tap', /\b(tap but)\b/],
      ['giai_tri', /\b(net|valo)\b/],
      ['an_uong', /\b(ca phe|date|matcha|hu tieu|buffet|ga ran|di cho)\b/],
    ];
    for (const [category, re] of extra)
      if (re.test(foldedSegment)) return { type: 'expense', category };
  }
  for (const [cat, re] of EXPENSE_RULES)
    if (re.test(foldedSegment)) return { type: 'expense', category: cat };
  return { type: 'expense', category: 'khac' };
}
