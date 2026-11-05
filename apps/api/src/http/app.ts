import { indexNotes, semanticSearch, semanticStatus } from './semantic.ts';
import { instrument } from '../telemetry.ts';
import { tenantPool, withTenant } from '../db/tenant.ts';
import { revisionInput, revise } from './revision.ts';
import { interpretQuestion } from './assistant.ts';
import express from 'express';
import type { Request, Response } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import * as argon2 from 'argon2';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import * as c from './contracts.ts';
import { apiRepository } from './repository.ts';
import { fail, errorHandler, HttpProblem } from './problem.ts';
import { localToday } from '../../../../packages/parser/src/index.ts';
import type { ExtractionResult } from '../extraction/hybrid.ts';
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    csrf?: string;
  }
}
export interface ApiOptions {
  pool: pg.Pool;
  sessionSecret: string;
  origin: string;
  production?: boolean;
  webRoot?: string;
  trustProxyHops?: number;
  now?: () => Date;
  extractor: {
    readonly providerName?: 'gemini' | 'fake';
    readonly moneyProfile?:
      'standard' | 'owner-confirmed-v1' | 'owner-confirmed-v2';
    parseHybrid(
      message: string,
      now: string,
      user: string,
    ): Promise<ExtractionResult>;
  };
  limits?: {
    login?: number;
    authIp?: number;
    register?: number;
    parse?: number;
  };
}
const strMoney = z.string().regex(/^(?:0|[1-9]\d*)$/);
const userSchema = z.strictObject({
  id: c.id,
  email: z.string(),
  display_name: z.string(),
});
const txSchema = z.strictObject({
  id: c.id,
  version: c.id,
  type: z.enum(['income', 'expense']),
  amount_vnd: strMoney,
  category: c.category,
  note: z.string(),
  occurred_on: c.day,
});
const goalSchema = z.strictObject({
  id: c.id,
  version: c.id,
  name: z.string(),
  target_vnd: strMoney,
  deadline: c.day,
  contributed_vnd: strMoney,
  remaining_vnd: strMoney,
  progress_basis_points: z.number().int().min(0).max(10000),
  days_left: z.number().int(),
  suggested_daily_saving_vnd: strMoney.nullable(),
});
const budgetSchema = z.strictObject({
  id: c.id,
  version: c.budgetVersion,
  category: c.category,
  month: c.day,
  limit_vnd: strMoney,
});
const totals = z.strictObject({
  income_vnd: strMoney,
  expense_vnd: strMoney,
  net_vnd: z.string().regex(/^-?\d+$/),
});
const notice = 'Thông tin tham khảo, không phải tư vấn tài chính.';
const jsonSchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input' });
function read<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) fail(400, 'Dữ liệu yêu cầu không hợp lệ.');
  return result.data;
}
function csv(value: string): string {
  const text = /^[\s]*[=+@\-\t\r]/.test(value) ? "'" + value : value;
  return '"' + text.replaceAll('"', '""') + '"';
}
export async function createApp(options: ApiOptions) {
  if (
    options.sessionSecret.length < 32 ||
    options.sessionSecret.startsWith('replace-')
  )
    throw new Error(
      'SESSION_SECRET must contain at least 32 random characters.',
    );
  const origin = new URL(options.origin);
  if (
    origin.origin !== options.origin ||
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    (options.production && origin.protocol !== 'https:')
  )
    throw new Error(
      'APP_ORIGIN must be an exact HTTP origin (HTTPS in production).',
    );
  if (
    !Number.isInteger(options.trustProxyHops ?? 0) ||
    (options.trustProxyHops ?? 0) < 0
  )
    throw new Error('Invalid proxy hop configuration.');
  const now = options.now ?? (() => new Date());
  const tenantDB = tenantPool(options.pool);
  const repo = apiRepository(tenantDB, options.sessionSecret);
  const app = express();
  const dummyHash = await argon2.hash(randomBytes(32).toString('hex'), {
    type: argon2.argon2id,
  });
  app.disable('x-powered-by');
  app.set('trust proxy', options.trustProxyHops ?? 0);
  app.use(helmet());
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (
      options.production &&
      !['/healthz', '/readyz'].includes(req.path) &&
      !req.secure
    ) {
      next(new HttpProblem(400, 'Yêu cầu HTTPS trong môi trường production.'));
      return;
    }
    const requestOrigin = req.get('origin');
    if (requestOrigin && requestOrigin !== options.origin) {
      next(new HttpProblem(403, 'Nguồn yêu cầu không được phép.'));
      return;
    }
    if (requestOrigin) {
      res.set('Access-Control-Allow-Origin', options.origin);
      res.set('Access-Control-Allow-Credentials', 'true');
      res.vary('Origin');
    }
    if (req.method === 'OPTIONS') {
      res.set(
        'Access-Control-Allow-Methods',
        'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      );
      res.set('Access-Control-Allow-Headers', 'Content-Type,X-CSRF-Token');
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '16kb', inflate: false }));
  const Store = connectPgSimple(session);
  const store = new Store({
    pool: options.pool,
    tableName: 'sessions',
    createTableIfMissing: false,
    pruneSessionInterval: options.production ? 900 : false,
    errorLog: () => {
      /* Never log raw DB/session objects. */
    },
  });
  const cookie = {
    httpOnly: true,
    secure: options.production ?? false,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 86400000,
  };
  app.use(
    session({
      name: 'sochat.sid',
      secret: options.sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie,
    }),
  );
  const paths: Record<string, Record<string, unknown>> = {};
  async function rate(
    _req: Request,
    res: Response,
    scope: string,
    identity: string,
    user: string | null,
    max: number,
    windowMs = 60000,
  ) {
    if (!(await repo.throttle(scope, identity, user, max, windowMs, now()))) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      fail(429, 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.');
    }
  }
  function checkCsrf(req: Request) {
    const token = req.get('x-csrf-token');
    if (
      !token ||
      !/^[0-9a-f]{64}$/.test(token) ||
      !req.session.csrf ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(req.session.csrf))
    )
      fail(403, 'CSRF token không hợp lệ.');
  }
  type Context<
    B extends z.ZodType,
    Q extends z.ZodType,
    P extends z.ZodType,
  > = {
    req: Request;
    res: Response;
    user: string;
    body: z.output<B>;
    query: z.output<Q>;
    params: z.output<P>;
  };
  function route<
    B extends z.ZodType = typeof c.empty,
    Q extends z.ZodType = typeof c.empty,
    P extends z.ZodType = typeof c.empty,
  >(
    method: 'get' | 'post' | 'patch' | 'put' | 'delete',
    path: string,
    spec: {
      body?: B;
      query?: Q;
      params?: P;
      public?: boolean;
      status?: number;
      response?: z.ZodType;
      csv?: boolean;
    },
    handler: (ctx: Context<B, Q, P>) => unknown | Promise<unknown>,
  ) {
    const write = ['post', 'put', 'patch', 'delete'].includes(method);
    const parameters: unknown[] = [];
    for (const [location, schema] of [
      ['query', spec.query],
      ['path', spec.params],
    ] as const) {
      if (!schema) continue;
      const root = jsonSchema(schema);
      for (const [name, value] of Object.entries(root.properties ?? {}))
        parameters.push({
          name,
          in: location,
          required:
            location === 'path' || root.required?.includes(name) || false,
          schema: value,
        });
    }
    if (write)
      parameters.push({
        name: 'X-CSRF-Token',
        in: 'header',
        required: true,
        schema: { type: 'string', pattern: '^[0-9a-f]{64}$' },
      });
    const code = spec.status ?? 200;
    paths[path.replace(/:(\w+)/g, '{$1}')] ??= {};
    paths[path.replace(/:(\w+)/g, '{$1}')]![method] = {
      operationId: method + path.replace(/[^a-zA-Z0-9]/g, '_'),
      security: spec.public ? [] : [{ cookieSession: [] }],
      parameters,
      ...(spec.body
        ? {
            requestBody: {
              required: true,
              content: {
                'application/json': { schema: jsonSchema(spec.body) },
              },
            },
          }
        : {}),
      responses: {
        [code]: {
          description: 'Success',
          ...(code === 204
            ? {}
            : {
                content: {
                  [spec.csv ? 'text/csv' : 'application/json']: {
                    schema: spec.csv
                      ? { type: 'string' }
                      : jsonSchema(spec.response ?? z.unknown()),
                  },
                },
              }),
        },
        ...Object.fromEntries(
          [400, 401, 403, 404, 409, 413, 415, 429, 500].map((status) => [
            status,
            {
              description: 'Problem response',
              content: {
                'application/problem+json': { schema: jsonSchema(c.problem) },
              },
            },
          ]),
        ),
      },
    };
    app[method](path, async (req, res) => {
      let user = req.session.userId ?? '';
      if (!spec.public) {
        if (!user || !(await repo.user(user))) fail(401, 'Bạn cần đăng nhập.');
      }
      if (write) checkCsrf(req);
      if (spec.body && !req.is('application/json'))
        fail(415, 'Yêu cầu nội dung JSON.');
      const body = read((spec.body ?? c.empty) as B, req.body ?? {});
      const query = read((spec.query ?? c.empty) as Q, req.query);
      const params = read((spec.params ?? c.empty) as P, req.params);
      user = req.session.userId ?? '';
      const result = await instrument(method, path, code, () =>
        withTenant(spec.public ? '' : user, async () =>
          handler({ req, res, user, body, query, params }),
        ),
      );
      if (res.headersSent) return;
      if (code === 204) {
        res.status(204).end();
        return;
      }
      res
        .status(code)
        .json(spec.response ? spec.response.parse(result) : result);
    });
  }
  const authResponse = z.strictObject({
    user: userSchema,
    csrf_token: z.string(),
  });
  async function authenticate(
    req: Request,
    user: { id: string; email: string; display_name: string },
  ) {
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((error) => (error ? reject(error) : resolve())),
    );
    req.session.userId = user.id;
    req.session.csrf = randomBytes(32).toString('hex');
    await new Promise<void>((resolve, reject) =>
      req.session.save((error) => (error ? reject(error) : resolve())),
    );
    return {
      user: { id: user.id, email: user.email, display_name: user.display_name },
      csrf_token: req.session.csrf,
    };
  }
  route(
    'get',
    '/healthz',
    { public: true, response: z.strictObject({ status: z.literal('ok') }) },
    () => ({ status: 'ok' }),
  );
  route(
    'get',
    '/readyz',
    { public: true, response: z.strictObject({ status: z.literal('ready') }) },
    async () => {
      try {
        await options.pool.query('SELECT 1');
      } catch {
        fail(503, 'Database chưa sẵn sàng.');
      }
      return { status: 'ready' as const };
    },
  );
  function clientIp(req: Request): string {
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
  }
  route(
    'get',
    '/api/auth/csrf',
    { public: true, response: z.strictObject({ csrf_token: z.string() }) },
    async ({ req, res }) => {
      await rate(req, res, 'csrf', clientIp(req), null, 60);
      req.session.csrf ??= randomBytes(32).toString('hex');
      return { csrf_token: req.session.csrf };
    },
  );
  route(
    'post',
    '/api/auth/register',
    { public: true, body: c.registration, status: 201, response: authResponse },
    async ({ req, res, body }) => {
      await rate(
        req,
        res,
        'register',
        clientIp(req),
        null,
        options.limits?.register ?? 10,
        600000,
      );
      const hash = await argon2.hash(body.password, { type: argon2.argon2id });
      return authenticate(
        req,
        await repo.register(body.email, hash, body.display_name),
      );
    },
  );
  route(
    'post',
    '/api/auth/login',
    { public: true, body: c.login, response: authResponse },
    async ({ req, res, body }) => {
      const found = await repo.findUser(body.email);
      const ip = clientIp(req);
      await rate(
        req,
        res,
        'login-ip',
        ip,
        null,
        options.limits?.authIp ?? 50,
        600000,
      );
      await rate(
        req,
        res,
        'login-pair',
        JSON.stringify([ip, body.email]),
        found?.id ?? null,
        options.limits?.login ?? 10,
        600000,
      );
      let valid: boolean;
      try {
        valid = await argon2.verify(
          found?.password_hash.startsWith('$argon2')
            ? found.password_hash
            : dummyHash,
          body.password,
        );
      } catch {
        valid = false;
      }
      if (!found || !valid) fail(401, 'Email hoặc mật khẩu không đúng.');
      return authenticate(req, found);
    },
  );
  route('post', '/api/auth/logout', { status: 204 }, async ({ req, res }) => {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((error) => (error ? reject(error) : resolve())),
    );
    res.clearCookie('sochat.sid', {
      path: '/',
      httpOnly: true,
      secure: cookie.secure,
      sameSite: 'lax',
    });
  });
  route(
    'get',
    '/api/me',
    { response: authResponse },
    async ({ req, user }) => ({
      user: await repo.user(user),
      csrf_token: req.session.csrf,
    }),
  );
  route('delete', '/api/me', { status: 204 }, async ({ req, res, user }) => {
    await repo.deleteUser(user);
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((error) => (error ? reject(error) : resolve())),
    );
    res.clearCookie('sochat.sid', {
      path: '/',
      httpOnly: true,
      secure: cookie.secure,
      sameSite: 'lax',
    });
  });
  route(
    'get',
    '/api/categories',
    {
      response: z.strictObject({
        items: z.array(
          z.strictObject({
            id: c.id,
            key: c.category,
            name_vi: z.string(),
            type: z.enum(['income', 'expense']),
          }),
        ),
      }),
    },
    async ({ user }) => ({ items: await repo.categories(user) }),
  );
  route(
    'get',
    '/api/chat/status',
    {
      response: z.strictObject({
        provider: z.enum(['gemini', 'fake']),
        money_profile: z.enum([
          'standard',
          'owner-confirmed-v1',
          'owner-confirmed-v2',
        ]),
      }),
    },
    () => ({
      provider: options.extractor.providerName ?? 'fake',
      money_profile: options.extractor.moneyProfile ?? 'standard',
    }),
  );
  route(
    'post',
    '/api/assistant/query',
    {
      body: c.message,
      response: z.strictObject({
        needs_clarification: z.boolean(),
        question: z.string(),
        month: c.month.nullable(),
        category: z.string().nullable(),
        income_vnd: strMoney,
        expense_vnd: strMoney,
        evidence_url: z.string().nullable(),
        mode: z.enum(['totals', 'largest_expenses', 'budget_usage']),
        largest: z.array(txSchema).max(5),
        budgets: z.array(
          z.object({
            category: c.category,
            limit_vnd: strMoney,
            spent_vnd: strMoney,
            remaining_vnd: strMoney,
            status: z.enum(['ok', 'warning', 'exceeded']),
          }),
        ),
        comparison: z
          .strictObject({
            month: c.month,
            income_vnd: strMoney,
            expense_vnd: strMoney,
            expense_change_vnd: z.string().regex(/^-?(?:0|[1-9]\d*)$/),
          })
          .nullable(),
      }),
    },
    async ({ req, res, user, body }) => {
      if (options.extractor.providerName !== 'gemini')
        fail(503, 'Hỏi cuốn sổ cần cấu hình Gemini thật.');
      await rate(req, res, 'assistant', user, user, 5);
      const intent = await interpretQuestion(
        body.message,
        now(),
        user,
        tenantDB,
      );
      if (
        intent.needs_clarification ||
        (intent.mode !== 'totals' && intent.compare_month)
      )
        return {
          needs_clarification: true,
          question:
            'Bạn có thể hỏi tổng thu/chi hoặc so sánh hai tháng, với tối đa một danh mục.',
          month: null,
          category: null,
          income_vnd: '0',
          expense_vnd: '0',
          evidence_url: null,
          comparison: null,
          mode: intent.mode,
          largest: [],
          budgets: [],
        };
      const detail = await repo.questionAnswer(
        user,
        intent.month,
        intent.compare_month,
        intent.category,
        intent.mode,
      );
      const totals = detail.totals;
      const current = totals.find((r) => r.month === intent.month) ?? {
        month: intent.month,
        income_vnd: '0',
        expense_vnd: '0',
      };
      const baseline = intent.compare_month
        ? (totals.find((r) => r.month === intent.compare_month) ?? {
            month: intent.compare_month,
            income_vnd: '0',
            expense_vnd: '0',
          })
        : null;
      return {
        needs_clarification: false,
        mode: intent.mode,
        largest: detail.largest,
        budgets: detail.budgets,
        question: 'Tổng hợp từ giao dịch đã lưu của bạn.',
        month: intent.month,
        category: intent.category,
        income_vnd: current.income_vnd,
        expense_vnd: current.expense_vnd,
        comparison: baseline
          ? {
              ...baseline,
              expense_change_vnd: (
                BigInt(current.expense_vnd) - BigInt(baseline.expense_vnd)
              ).toString(),
            }
          : null,
        evidence_url:
          '/api/transactions?from=' +
          intent.month +
          '-01&to=' +
          new Date(
            Date.parse(c.nextMonth(intent.month) + 'T00:00:00Z') - 86400000,
          )
            .toISOString()
            .slice(0, 10) +
          (intent.category ? '&category=' + intent.category : '') +
          (intent.mode === 'totals' ? '' : '&type=expense'),
      };
    },
  );
  const proposal = z.strictObject({
    provider: z.enum(['gemini', 'fake']),
    items: z.array(
      z.object({
        type: z.enum(['income', 'expense']),
        category: c.category,
        amount_vnd: z.number().int().positive().max(100_000_000_000).nullable(),
        occurred_on: c.day.nullable(),
        note: z.string(),
        flags: z.array(z.string()),
        needs_confirmation: z.literal(true),
        confidence: z.number().min(0).max(1).nullable(),
      }),
    ),
    needs_clarification: z.boolean(),
    questions: z.array(z.string()),
    reasons: z.array(z.string()),
    path: z.enum(['rules', 'llm', 'cache']),
    attempts: z.number().int().nonnegative(),
    usage: z.strictObject({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative(),
    }),
  });
  route(
    'post',
    '/api/chat/parse',
    { body: c.message, response: proposal },
    async ({ req, res, user, body }) => {
      await rate(req, res, 'parse', user, user, options.limits?.parse ?? 20);
      return {
        provider: options.extractor.providerName ?? 'fake',
        ...(await options.extractor.parseHybrid(
          body.message,
          now().toISOString(),
          user,
        )),
      };
    },
  );
  route(
    'get',
    '/api/assistant/search-status',
    {
      response: z.strictObject({
        indexed: z.number().int().min(0).max(1000),
        pending: z.number().int().min(0).max(1000),
        total: z.number().int().min(0).max(1000),
      }),
    },
    async ({ user }) => semanticStatus(user, tenantDB),
  );
  route(
    'post',
    '/api/assistant/index',
    {
      body: c.empty,
      response: z.strictObject({ indexed: z.number().int().min(0).max(20) }),
    },
    async ({ req, res, user }) => {
      if (options.extractor.providerName !== 'gemini')
        fail(503, 'Cần Gemini thật.');
      await rate(req, res, 'embedding', user, user, 10);
      return indexNotes(user, tenantDB, now());
    },
  );
  route(
    'post',
    '/api/assistant/search',
    {
      body: z.strictObject({ query: z.string().trim().min(1).max(300) }),
      response: z.strictObject({
        indexed: z.number().int().min(0).max(1000),
        items: z
          .array(
            txSchema
              .omit({ category: true })
              .extend({ score: z.number().finite() }),
          )
          .max(5),
      }),
    },
    async ({ req, res, user, body }) => {
      if (options.extractor.providerName !== 'gemini')
        fail(503, 'Cần Gemini thật.');
      await rate(req, res, 'semantic', user, user, 5);
      return semanticSearch(body.query, user, tenantDB, now());
    },
  );
  const preferences = z.strictObject({
    semantic_enabled: z.boolean(),
  });
  route(
    'get',
    '/api/me/ai-preferences',
    { response: preferences },
    async ({ user }) => {
      const result = await tenantDB.query(
        'SELECT semantic_enabled FROM ai_preferences WHERE user_id=$1',
        [user],
      );
      return result.rows[0] ?? { semantic_enabled: false };
    },
  );
  route(
    'put',
    '/api/me/ai-preferences',
    { body: preferences, response: preferences },
    async ({ user, body }) => {
      const client = await tenantDB.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'INSERT INTO ai_preferences(user_id,semantic_enabled) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET semantic_enabled=$2,updated_at=now()',
          [user, body.semantic_enabled],
        );
        if (!body.semantic_enabled)
          await client.query(
            'DELETE FROM transaction_embeddings WHERE user_id=$1',
            [user],
          );
        await client.query('COMMIT');
        return body;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  );
  route(
    'post',
    '/api/assistant/revise',
    {
      body: revisionInput,
      response: z.strictObject({
        items: revisionInput.shape.items,
        needs_clarification: z.boolean(),
        question: z.string(),
        changed_indices: z.array(z.number().int()),
      }),
    },
    async ({ req, res, user, body }) => {
      if (options.extractor.providerName !== 'gemini')
        fail(503, 'Chỉnh bằng hội thoại cần Gemini thật.');
      await rate(req, res, 'revision', user, user, 5);
      return revise(body, now(), user, tenantDB);
    },
  );
  route(
    'post',
    '/api/transactions/batch',
    {
      body: c.batch,
      status: 201,
      response: z.strictObject({ items: z.array(txSchema) }),
    },
    ({ user, body }) => repo.batch(user, body),
  );
  route(
    'get',
    '/api/transactions',
    {
      query: c.listQuery,
      response: z.strictObject({
        items: z.array(txSchema),
        next_cursor: z.string().nullable(),
      }),
    },
    ({ user, query }) => repo.transactions(user, query),
  );
  route(
    'patch',
    '/api/transactions/:id',
    { body: c.transactionPatch, params: c.idParams, response: txSchema },
    ({ user, params, body }) => repo.patchTransaction(user, params.id, body),
  );
  route(
    'delete',
    '/api/transactions/:id',
    {
      params: c.idParams,
      query: z.strictObject({ version: c.id }),
      status: 204,
    },
    ({ user, params, query }) =>
      repo.deleteTransaction(user, params.id, query.version),
  );
  route(
    'get',
    '/api/reports/month',
    {
      query: c.monthQuery,
      response: z.strictObject({
        totals,
        by_category: z.array(
          z.strictObject({
            category: c.category,
            name_vi: z.string(),
            type: z.enum(['income', 'expense']),
            total_vnd: strMoney,
          }),
        ),
        daily: z.array(
          z.strictObject({
            occurred_on: c.day,
            type: z.enum(['income', 'expense']),
            total_vnd: strMoney,
          }),
        ),
        top_notes: z.array(
          z.strictObject({ note: z.string(), total_vnd: strMoney }),
        ),
        notice: z.string(),
      }),
    },
    async ({ user, query }) => ({
      ...(await repo.month(
        user,
        query.month + '-01',
        c.nextMonth(query.month),
      )),
      notice,
    }),
  );
  route(
    'get',
    '/api/reports/year',
    {
      query: c.yearQuery,
      response: z.strictObject({
        totals,
        months: z.array(
          z.strictObject({
            month: c.month,
            type: z.enum(['income', 'expense']),
            total_vnd: strMoney,
          }),
        ),
        notice: z.string(),
      }),
    },
    async ({ user, query }) => ({
      ...(await repo.year(
        user,
        String(query.year).padStart(4, '0') + '-01-01',
        String(query.year + 1).padStart(4, '0') + '-01-01',
      )),
      notice,
    }),
  );
  const budgetResponse = z.strictObject({ items: z.array(budgetSchema) });
  route(
    'get',
    '/api/budgets',
    { query: c.monthQuery, response: budgetResponse },
    async ({ user, query }) => ({
      items: await repo.budgets(user, query.month + '-01'),
    }),
  );
  route(
    'put',
    '/api/budgets',
    { query: c.monthQuery, body: c.budgets, response: budgetResponse },
    async ({ user, query, body }) => ({
      items: await repo.putBudgets(user, query.month + '-01', body),
    }),
  );
  route(
    'delete',
    '/api/budgets/:category',
    {
      query: c.monthQuery.extend({ version: c.budgetVersion }),
      params: z.strictObject({ category: c.category }),
      status: 204,
    },
    async ({ user, query, params }) => {
      if (
        !(await repo.deleteBudget(
          user,
          query.month + '-01',
          params.category,
          query.version,
        ))
      )
        fail(404, 'Không tìm thấy ngân sách trong tháng đã chọn.');
    },
  );
  route(
    'get',
    '/api/budgets/status',
    {
      query: c.monthQuery,
      response: z.strictObject({
        items: z.array(
          z.strictObject({
            category: c.category,
            version: c.budgetVersion,
            limit_vnd: strMoney,
            spent_vnd: strMoney,
            remaining_vnd: strMoney,
            status: z.enum(['ok', 'warning', 'exceeded']),
          }),
        ),
      }),
    },
    async ({ user, query }) => ({
      items: await repo.budgetStatus(
        user,
        query.month + '-01',
        c.nextMonth(query.month),
      ),
    }),
  );
  function goalView(
    row:
      | {
          id: string;
          version: string;
          name: string;
          target_vnd: string;
          deadline: string;
          contributed_vnd: string;
        }
      | undefined,
  ) {
    if (!row) fail(404, 'Không tìm thấy quỹ.');
    const target = BigInt(row.target_vnd),
      contributed = BigInt(row.contributed_vnd),
      remaining = target > contributed ? target - contributed : 0n;
    const today = localToday(now().toISOString());
    if (!today) fail(500, 'Không xác định được ngày.');
    const days = Math.round(
      (Date.parse(row.deadline + 'T00:00:00Z') - today.getTime()) / 86400000,
    );
    return {
      ...row,
      remaining_vnd: remaining.toString(),
      progress_basis_points: Number(
        contributed >= target ? 10000n : (contributed * 10000n) / target,
      ),
      days_left: days,
      suggested_daily_saving_vnd:
        remaining === 0n
          ? '0'
          : days <= 0
            ? null
            : ((remaining + BigInt(days) - 1n) / BigInt(days)).toString(),
    };
  }
  route(
    'get',
    '/api/goals/creation-status/:key',
    {
      params: z.strictObject({ key: z.uuid() }),
      response: z.strictObject({
        state: z.enum(['saved', 'deleted', 'unknown']),
        goal_id: c.id.optional(),
      }),
    },
    ({ user, params }) => repo.goalCreationStatus(user, params.key),
  );
  route(
    'get',
    '/api/goals',
    { response: z.strictObject({ items: z.array(goalSchema) }) },
    async ({ user }) => ({ items: (await repo.goals(user)).map(goalView) }),
  );
  route(
    'get',
    '/api/goals/:id',
    { params: c.idParams, response: goalSchema },
    async ({ user, params }) =>
      goalView((await repo.goals(user, params.id))[0]),
  );
  route(
    'post',
    '/api/goals',
    { body: c.goalCreate, status: 201, response: goalSchema },
    async ({ user, body }) => goalView(await repo.createGoal(user, body)),
  );
  route(
    'patch',
    '/api/goals/:id',
    { body: c.goalPatch, params: c.idParams, response: goalSchema },
    async ({ user, params, body }) =>
      goalView(await repo.patchGoal(user, params.id, body)),
  );
  route(
    'delete',
    '/api/goals/:id',
    {
      params: c.idParams,
      query: z.strictObject({ version: c.id }),
      status: 204,
    },
    ({ user, params, query }) =>
      repo.deleteGoal(user, params.id, query.version),
  );
  route(
    'post',
    '/api/goals/:id/contributions',
    {
      params: c.idParams,
      body: c.contribution,
      status: 201,
      response: z.strictObject({
        id: c.id,
        amount_vnd: strMoney,
        contributed_on: c.day,
        note: z.string(),
      }),
    },
    ({ user, params, body }) => repo.contribute(user, params.id, body),
  );
  route('get', '/api/me/export', { csv: true }, async ({ req, res, user }) => {
    await rate(req, res, 'export', user, user, 3);
    const timer = setTimeout(() => res.destroy(), 30000);
    try {
      await repo.exportSnapshot(user, async (page) => {
        res
          .status(200)
          .type('text/csv')
          .set(
            'Content-Disposition',
            'attachment; filename="sochat-transactions.csv"',
          );
        res.write('\uFEFFid,type,amount_vnd,category,note,occurred_on\r\n');
        let after = '0';
        for (;;) {
          if (res.destroyed) return;
          const rows = await page(after);
          if (!rows.length) break;
          for (const row of rows) {
            if (res.destroyed) return;
            const line =
              [
                row.id,
                row.type,
                row.amount_vnd,
                row.category,
                row.note,
                row.occurred_on,
              ]
                .map(csv)
                .join(',') + '\r\n';
            if (!res.write(line)) {
              await new Promise<void>((resolve) => {
                const done = () => {
                  res.off('drain', done);
                  res.off('close', done);
                  res.off('error', done);
                  resolve();
                };
                res.once('drain', done);
                res.once('close', done);
                res.once('error', done);
              });
              if (res.destroyed) return;
            }
          }
          after = rows.at(-1)?.id ?? after;
        }
        res.end();
      });
    } finally {
      clearTimeout(timer);
    }
  });
  const openapi = {
    openapi: '3.1.0',
    info: {
      title: 'SổChat API',
      version: '0.1.0',
      description:
        'Money is integer VND. API amounts are decimal strings; parse proposals are safe bounded numbers. Start with GET /api/auth/csrf, then send its token and cookie on writes. Auth success rotates both. Parse does not save ledger transactions.',
    },
    paths,
    components: {
      securitySchemes: {
        cookieSession: { type: 'apiKey', in: 'cookie', name: 'sochat.sid' },
      },
    },
  };
  app.get('/openapi.json', (_req, res) => res.json(openapi));
  if (options.webRoot)
    app.use(
      express.static(options.webRoot, {
        dotfiles: 'deny',
        redirect: false,
        setHeaders(res, file) {
          if (/[/\\]assets[/\\]/.test(file))
            res.setHeader(
              'Cache-Control',
              'public, max-age=31536000, immutable',
            );
        },
      }),
    );
  app.use((_req, _res, next) =>
    next(new HttpProblem(404, 'Không tìm thấy đường dẫn.')),
  );
  app.use(errorHandler);
  return {
    app,
    openapi,
    close: async () => {
      await store.close();
    },
  };
}
