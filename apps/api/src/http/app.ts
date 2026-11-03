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
  trustProxyHops?: number;
  now?: () => Date;
  extractor: {
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
  type: z.enum(['income', 'expense']),
  amount_vnd: strMoney,
  category: c.category,
  note: z.string(),
  occurred_on: c.day,
});
const goalSchema = z.strictObject({
  id: c.id,
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
  const repo = apiRepository(options.pool, options.sessionSecret);
  const app = express();
  const dummyHash = await argon2.hash(randomBytes(32).toString('hex'), {
    type: argon2.argon2id,
  });
  app.disable('x-powered-by');
  app.set('trust proxy', options.trustProxyHops ?? 0);
  app.use(helmet());
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (options.production && req.path !== '/healthz' && !req.secure) {
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
      const result = await handler({ req, res, user, body, query, params });
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
    '/api/auth/csrf',
    { public: true, response: z.strictObject({ csrf_token: z.string() }) },
    async ({ req, res }) => {
      await rate(req, res, 'csrf', req.ip ?? 'unknown', null, 60);
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
        req.ip ?? 'unknown',
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
      await rate(
        req,
        res,
        'login-ip',
        req.ip ?? 'unknown',
        null,
        options.limits?.authIp ?? 50,
        600000,
      );
      await rate(
        req,
        res,
        'login-pair',
        JSON.stringify([req.ip, body.email]),
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
  const proposal = z.strictObject({
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
      return options.extractor.parseHybrid(
        body.message,
        now().toISOString(),
        user,
      );
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
    { params: c.idParams, status: 204 },
    ({ user, params }) => repo.deleteTransaction(user, params.id),
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
    'get',
    '/api/budgets/status',
    {
      query: c.monthQuery,
      response: z.strictObject({
        items: z.array(
          z.strictObject({
            category: c.category,
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
    { body: c.goal, status: 201, response: goalSchema },
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
    { params: c.idParams, status: 204 },
    ({ user, params }) => repo.deleteGoal(user, params.id),
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
    res
      .status(200)
      .type('text/csv')
      .set(
        'Content-Disposition',
        'attachment; filename="sochat-transactions.csv"',
      );
    res.write('id,type,amount_vnd,category,note,occurred_on\r\n');
    let after = '0';
    for (;;) {
      if (res.destroyed) return;
      const rows = await repo.exportRows(user, after);
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
