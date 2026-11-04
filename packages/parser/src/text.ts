/** Fold Vietnamese while preserving UTF-16 offsets into the NFC original. */
export function fold(text: string): string {
  return Array.from(text.normalize('NFC'))
    .map((ch) => {
      const lower = ch.toLowerCase();
      const folded =
        lower === 'đ'
          ? 'd'
          : lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      // Some non-Vietnamese Unicode characters expand when folded. Keep their
      // original width so amount offsets and original-language notes stay aligned.
      return folded.length === ch.length ? folded : ch;
    })
    .join('');
}

const MASKS = [
  /\b\d{1,2}\s*\/\s*\d{1,2}(?:\s*\/\s*\d{2,4})?\b/g,
  /\bngay\s+\d{1,2}(?:\s+thang\s+\d{1,2})?(?:\s+nam\s+\d{4})?\b/g,
  /\bthu\s+[2-7]\b/g,
  /\b\d{1,2}\s*(?:h|gio)\s*\d{0,2}\b|\b\d{1,2}:\d{2}\b/g,
];

export function maskNoise(text: string): string {
  return MASKS.reduce(
    (s, regex) => s.replace(regex, (match) => ' '.repeat(match.length)),
    text,
  );
}

export function splitSegments(
  original: string,
  ownerProfile = false,
): { text: string; folded: string }[] {
  const folded = fold(original);
  const result: { text: string; folded: string }[] = [];
  let previous = 0;
  for (const match of folded.matchAll(
    ownerProfile
      ? /;|\n|\+|,(?!\d)|(?<!\d),|\s+va\s+|\s+roi\s+|\s+(?=phi (?:ship|van chuyen|giao hang)\b)/g
      : /;|\n|\+|,(?!\d)|(?<!\d),|\s+va\s+/g,
  )) {
    const text = original.slice(previous, match.index).trim();
    if (text) result.push({ text, folded: fold(text) });
    previous = match.index + match[0].length;
  }
  const text = original.slice(previous).trim();
  if (text) result.push({ text, folded: fold(text) });
  return result;
}
