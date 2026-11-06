import type { ErrorRequestHandler, Response } from 'express';
export class HttpProblem extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}
export function fail(status: number, detail: string): never {
  throw new HttpProblem(status, detail);
}
export function sendProblem(
  res: Response,
  status: number,
  detail: string,
): void {
  res
    .status(status)
    .type('application/problem+json')
    .json({
      type: 'about:blank',
      title:
        status === 404
          ? 'Not Found'
          : status === 401
            ? 'Unauthorized'
            : status === 403
              ? 'Forbidden'
              : status === 429
                ? 'Too Many Requests'
                : status >= 500
                  ? 'Internal Server Error'
                  : 'Request Failed',
      status,
      detail,
    });
}
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  void _next;
  if (res.headersSent) {
    res.destroy();
    return;
  }
  if (error instanceof HttpProblem) {
    sendProblem(res, error.status, error.message);
    return;
  }
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : null;
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? error.status
      : null;
  if (code === '23505') {
    sendProblem(res, 409, 'Dữ liệu bị trùng.');
    return;
  }
  if (code === '23503') {
    sendProblem(res, 404, 'Không tìm thấy dữ liệu.');
    return;
  }
  if (code === '23514' || code === '22007' || code === '22008') {
    sendProblem(res, 400, 'Dữ liệu không hợp lệ.');
    return;
  }
  if (status === 400 || status === 413 || status === 415) {
    sendProblem(res, status, 'Nội dung yêu cầu không hợp lệ hoặc quá lớn.');
    return;
  }
  if (process.env.NODE_ENV !== 'test') {
    console.error('Unhandled server error:', error);
  }
  sendProblem(res, 500, 'Không thể xử lý yêu cầu lúc này.');
};
