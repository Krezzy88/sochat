import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  parseMessage,
  extractAmounts,
  fold,
  localToday,
} from '../../../../packages/parser/src/index.ts';
import type {
  Classification,
  MoneyProfile,
  ParsedItem,
} from '../../../../packages/parser/src/index.ts';
import { LlmResult } from './schema.ts';
import type { LlmOutput } from './schema.ts';
import { PROMPT_VERSION, ProviderError } from './provider.ts';
import type { ExtractionProvider, Usage } from './provider.ts';
import { validateCaps } from './store.ts';
import type { Caps, ExtractionStore } from './store.ts';
export type ProposalItem = Classification &
  Omit<ParsedItem, 'type' | 'category' | 'flags'> & {
    flags: string[];
    needs_confirmation: true;
    confidence: number | null;
  };
export interface ExtractionResult {
  items: ProposalItem[];
  needs_clarification: boolean;
  questions: string[];
  reasons: string[];
  path: 'rules' | 'llm' | 'cache';
  attempts: number;
  usage: Usage;
}
export interface CallLog extends Usage {
  latency_ms: number;
  outcome:
    | 'success'
    | 'invalid_output'
    | 'transient'
    | 'timeout'
    | 'unavailable'
    | 'authentication'
    | 'invalid_response'
    | 'failure';
}
const ZERO: Usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
export function cacheKey(
  message: string,
  today: string,
  model: string,
  profile: MoneyProfile = 'standard',
): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        message.normalize('NFC').trim(),
        today,
        PROMPT_VERSION,
        model,
        profile,
      ]),
    )
    .digest('hex');
}
export function guardAmounts(
  message: string,
  items: LlmOutput['items'],
  profile: MoneyProfile = 'standard',
): ProposalItem[] {
  const mentions = extractAmounts(fold(message), profile)
    .map((a) => a.value)
    .filter((v): v is number => v !== null);
  const remaining = new Map<number, number>();
  for (const amount of mentions)
    remaining.set(amount, (remaining.get(amount) ?? 0) + 1);
  const present = new Set(mentions);
  return items.map((item) => {
    const flags: string[] = [];
    const available =
      item.amount_vnd === null ? 0 : (remaining.get(item.amount_vnd) ?? 0);
    if (item.occurred_on === null) flags.push('llm_missing_date');
    if (item.amount_vnd === null) flags.push('llm_missing_amount');
    if (item.amount_vnd === null) {
      /* Unresolved money stays empty. */
    } else if (!present.has(item.amount_vnd))
      flags.push('llm_amount_not_in_message');
    else if (available === 0) flags.push('llm_amount_reused');
    if (item.amount_vnd !== null)
      remaining.set(item.amount_vnd, Math.max(0, available - 1));
    if (item.confidence < 0.8) flags.push('low_confidence');
    if (item.amount_vnd !== null && item.amount_vnd < 1000)
      flags.push('tiny_amount');
    // Never trust model-authored notes as free-form instructions or explanations.
    return {
      ...item,
      ...({ type: item.type, category: item.category } as Classification),
      amount_vnd: available > 0 ? item.amount_vnd : null,
      note: message.normalize('NFC').slice(0, 120),
      flags,
      needs_confirmation: true,
    };
  });
}
export interface ExtractorOptions {
  moneyProfile?: MoneyProfile;
  timeoutMs?: number;
  quotaNow?: () => string;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  log?: (event: CallLog) => void;
}
export class HybridExtractor {
  get moneyProfile(): MoneyProfile {
    return this.options.moneyProfile ?? 'standard';
  }
  get providerName(): 'gemini' | 'fake' {
    return this.provider.model === 'fake-v1' ? 'fake' : 'gemini';
  }
  private readonly provider: ExtractionProvider;
  private readonly store: ExtractionStore;
  private readonly caps: Caps;
  private readonly options: ExtractorOptions;
  constructor(
    provider: ExtractionProvider,
    store: ExtractionStore,
    caps: Caps,
    options: ExtractorOptions = {},
  ) {
    this.provider = provider;
    this.store = store;
    this.caps = caps;
    this.options = options;
    validateCaps(caps);
    if (
      options.timeoutMs !== undefined &&
      (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
    )
      throw new Error('Invalid extraction timeout');
  }
  async parseHybrid(
    message: string,
    now: string,
    user: string,
    mode: 'hybrid' | 'llm' = 'hybrid',
  ): Promise<ExtractionResult> {
    const rules = parseMessage(message, now, this.options.moneyProfile);
    const base: ExtractionResult = {
      ...rules,
      items:
        mode === 'llm'
          ? []
          : rules.items.map((item) => ({
              ...item,
              confidence: null,
              needs_confirmation: true,
            })),
      path: 'rules',
      attempts: 0,
      usage: { ...ZERO },
    };
    if (
      rules.reasons.some((r) => r === 'message_too_long' || r === 'invalid_now')
    )
      return base;
    const low = rules.items.some((item) => item.category === 'khac');
    if (mode === 'hybrid' && !rules.needs_clarification && !low) return base;
    const today = localToday(now)?.toISOString().slice(0, 10);
    if (!today) return base;
    const failure = (reason: string): ExtractionResult => ({
      ...base,
      needs_clarification: true,
      reasons: [...new Set([...base.reasons, reason])],
      questions: [
        ...base.questions,
        'Chưa thể xác định chắc chắn khoản tiền. Bạn kiểm tra hoặc nhập rõ số tiền và ngày nhé?',
      ],
    });
    const key = cacheKey(
      message,
      today,
      this.provider.model,
      this.options.moneyProfile,
    );
    const validated = (
      value: unknown,
      path: 'llm' | 'cache',
    ): ExtractionResult | null => {
      const parsed = LlmResult.safeParse(value);
      if (!parsed.success) return null;
      const modelItems = guardAmounts(
        message,
        parsed.data.items,
        this.options.moneyProfile,
      );
      const resolvedSplit =
        this.moneyProfile === 'owner-confirmed-v2' &&
        mode === 'hybrid' &&
        rules.reasons.length === 1 &&
        rules.reasons[0] === 'multiple_amounts' &&
        !/\b(giam|con|gia|cu|moi|thay|hoac|hay|tong|chia|share)\b/.test(
          fold(message),
        ) &&
        modelItems.length > base.items.length &&
        modelItems.length ===
          extractAmounts(fold(message), this.moneyProfile).length &&
        modelItems.every(
          (i) => i.flags.length === 0 && i.amount_vnd !== null,
        ) &&
        !parsed.data.needs_clarification;
      const partialSplit =
        mode === 'hybrid' &&
        rules.reasons.length === 1 &&
        rules.reasons[0] === 'bare_small_number' &&
        modelItems.length > base.items.length &&
        modelItems.every((i) => i.amount_vnd === null);
      const candidates =
        partialSplit || resolvedSplit
          ? modelItems
          : mode === 'hybrid' &&
              rules.reasons.some((r) =>
                [
                  'multiple_amounts',
                  'bare_small_number',
                  'negative_amount',
                  'zero_amount',
                  'malformed_amount',
                  'amount_out_of_range',
                ].includes(r),
              )
            ? base.items.map((i) => ({
                ...i,
                flags: [
                  ...new Set([
                    ...i.flags,
                    ...modelItems.flatMap((m) => m.flags),
                  ]),
                ],
              }))
            : modelItems.length
              ? modelItems
              : base.items;
      const items = rules.reasons.includes('invalid_date')
        ? candidates.map((i) => ({ ...i, occurred_on: null }))
        : candidates;
      // Only grounded owner-approved purchase segmentation resolves multiple_amounts.
      // Other safety ambiguities cannot be erased by model confidence.
      const unresolved =
        (rules.needs_clarification && !resolvedSplit) ||
        items.some((i) => i.flags.length > 0) ||
        parsed.data.needs_clarification;
      const reasons = [
        ...new Set([
          ...(resolvedSplit ? [] : rules.reasons),
          ...items.flatMap((i) => i.flags),
        ]),
      ];
      return {
        ...base,
        items,
        path,
        needs_clarification: unresolved,
        reasons,
        questions: unresolved
          ? [
              ...rules.questions,
              'Bạn xác nhận hoặc chỉnh lại các trường chưa rõ trước khi lưu nhé?',
            ]
          : [],
      };
    };
    try {
      const cached = await this.store.get(user, key);
      if (cached !== null) {
        const result = validated(cached, 'cache');
        if (result) return result;
      }
      const deadline = performance.now() + (this.options.timeoutMs ?? 8000);
      const total: Usage = { ...ZERO };
      let attempts = 0;
      for (let retry = 0; retry <= 2; retry++) {
        if (performance.now() >= deadline)
          return { ...failure('llm_timeout'), attempts, usage: total };
        if (
          !(await this.store.reserve(
            user,
            localToday(
              (this.options.quotaNow ?? (() => new Date().toISOString()))(),
            )
              ?.toISOString()
              .slice(0, 10) ??
              (() => {
                throw new Error('Invalid operational clock');
              })(),
            this.caps,
          ))
        )
          return { ...failure('llm_cap_reached'), attempts, usage: total };
        const controller = new AbortController();
        const started = performance.now();
        let timer: ReturnType<typeof setTimeout> | undefined;
        attempts++;
        try {
          const response = await Promise.race([
            this.provider.extract({ message, today }, controller.signal),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => {
                  controller.abort();
                  reject(new ProviderError('timeout'));
                },
                Math.max(1, deadline - performance.now()),
              );
            }),
          ]);
          const usage: Usage = {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
          };
          for (const name of Object.keys(usage) as (keyof Usage)[]) {
            const value = response.usage[name];
            if (Number.isSafeInteger(value) && value >= 0) {
              usage[name] = value;
              total[name] += value;
            }
          }
          const result = validated(response.output, 'llm');
          this.options.log?.({
            ...usage,
            latency_ms: performance.now() - started,
            outcome: result ? 'success' : 'invalid_output',
          });
          if (!result)
            return { ...failure('llm_invalid_output'), attempts, usage: total };
          try {
            await this.store.put(
              user,
              key,
              this.provider.model,
              LlmResult.parse(response.output),
            );
          } catch {
            /* Cache is optional; the provider attempt was already logged. */
          }
          return { ...result, attempts, usage: total };
        } catch (error) {
          const safe = error instanceof ProviderError ? error.code : 'failure';
          this.options.log?.({
            ...ZERO,
            latency_ms: performance.now() - started,
            outcome: safe,
          });
          if (
            !(error instanceof ProviderError) ||
            !error.retryable ||
            retry === 2
          )
            return { ...failure(`llm_${safe}`), attempts, usage: total };
        } finally {
          if (timer) clearTimeout(timer);
          controller.abort();
        }
        const wait = Math.min(
          100 * 2 ** retry +
            Math.floor((this.options.random ?? Math.random)() * 100),
          Math.max(0, deadline - performance.now()),
        );
        await (
          this.options.sleep ??
          ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
        )(wait);
      }
      return failure('llm_failure');
    } catch {
      return failure('llm_storage_or_processing_failure');
    }
  }
}
