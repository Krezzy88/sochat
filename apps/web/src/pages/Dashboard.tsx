import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money, request, today, dateLabel } from '../api.ts';
import type { MonthReport, YearReport } from '../api.ts';
import { Empty, Loading, LoadError, useLoad } from '../ui.tsx';
export default function Dashboard() {
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [year, setYear] = useState(today().slice(0, 4));
  const [yearInput, setYearInput] = useState(year);
  const state = useLoad<MonthReport | YearReport>(
    () =>
      period === 'month'
        ? request<MonthReport>('/reports/month?month=' + month)
        : request<YearReport>('/reports/year?year=' + year),
    [period, month, year],
  );
  const d = state.data;
  const rows: { label: string; income: string; expense: string }[] =
    period === 'month' && d && 'daily' in d
      ? Array.from(new Set(d.daily.map((r) => r.occurred_on)))
          .sort()
          .map((day) => ({
            label: day,
            income:
              d.daily.find((r) => r.occurred_on === day && r.type === 'income')
                ?.total_vnd ?? '0',
            expense:
              d.daily.find((r) => r.occurred_on === day && r.type === 'expense')
                ?.total_vnd ?? '0',
          }))
      : d && 'months' in d
        ? Array.from({ length: 12 }, (_, i) => {
            const m = year + '-' + String(i + 1).padStart(2, '0');
            return {
              label: m,
              income:
                d.months.find((r) => r.month === m && r.type === 'income')
                  ?.total_vnd ?? '0',
              expense:
                d.months.find((r) => r.month === m && r.type === 'expense')
                  ?.total_vnd ?? '0',
            };
          })
        : [];
  // Chart coordinates are approximate thousands; exact amounts remain in the table.
  const chart = rows.map((r) => ({
    name: period === 'month' ? r.label.slice(8) : 'T' + r.label.slice(5),
    Thu: Number(BigInt(r.income) / 1000n),
    Chi: Number(BigInt(r.expense) / 1000n),
  }));
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">BỨC TRANH THU CHI</span>
          <h1>Tổng quan</h1>
          <p>Hiểu những khoản đã qua, nhẹ đầu cho ngày tới.</p>
        </div>
        <div className="period-controls">
          <label className="period-kind" htmlFor="period">
            Kỳ báo cáo
            <select
              id="period"
              aria-label="Kỳ báo cáo"
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'month' | 'year')}
            >
              <option value="month">Theo tháng</option>
              <option value="year">Theo năm</option>
            </select>
          </label>
          {period === 'month' ? (
            <label>
              Tháng
              <input
                aria-label="Tháng báo cáo"
                type="month"
                required
                value={month}
                onChange={(e) => {
                  if (e.target.value) setMonth(e.target.value);
                }}
              />
            </label>
          ) : (
            <label>
              Năm
              <input
                aria-label="Năm báo cáo"
                type="number"
                min="1"
                max="9998"
                value={yearInput}
                onChange={(e) => {
                  setYearInput(e.target.value);
                  if (
                    /^\d{4}$/.test(e.target.value) &&
                    Number(e.target.value) > 0 &&
                    Number(e.target.value) < 9999
                  )
                    setYear(e.target.value);
                }}
                onBlur={() => setYearInput(year)}
              />
            </label>
          )}
        </div>
      </header>
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <LoadError error={state.error} retry={state.reload} />
      ) : (
        d && (
          <>
            <div className="stats-grid">
              <section className="stat-card">
                <span>Tổng thu</span>
                <strong className="income">{money(d.totals.income_vnd)}</strong>
                <small>Những khoản bạn nhận được</small>
              </section>
              <section className="stat-card">
                <span>Tổng chi</span>
                <strong>{money(d.totals.expense_vnd)}</strong>
                <small>Những khoản bạn đã chi</small>
              </section>
              <section className="stat-card stat-accent">
                <span>Thu trừ chi</span>
                <strong>{money(d.totals.net_vnd)}</strong>
                <small>Chênh lệch trong kỳ đã chọn</small>
              </section>
            </div>
            {d.totals.income_vnd === '0' && d.totals.expense_vnd === '0' ? (
              <Empty title="Một trang sổ còn trống">
                Chưa có khoản thu chi trong kỳ này.{' '}
                <a href="#chat">Ghi một khoản nhé →</a>
              </Empty>
            ) : (
              <section className="panel chart-panel">
                <div className="section-heading">
                  <div>
                    <h2>Nhịp thu chi</h2>
                    <p className="muted">
                      Biểu đồ đơn vị nghìn đồng · Bảng bên dưới hiển thị số tiền
                      chính xác.
                    </p>
                  </div>
                </div>
                <div
                  className="chart"
                  role="img"
                  aria-label={
                    'Biểu đồ thu chi theo ' +
                    (period === 'month' ? 'ngày' : 'tháng') +
                    '. Bảng dữ liệu chính xác ngay bên dưới.'
                  }
                >
                  <ResponsiveContainer width="100%" height="100%">
                    {period === 'month' ? (
                      <LineChart data={chart} accessibilityLayer>
                        <CartesianGrid vertical={false} stroke="#e2e8e2" />
                        <XAxis dataKey="name" />
                        <YAxis width={55} />
                        <Tooltip />
                        <Legend />
                        <Line
                          name="Thu"
                          type="monotone"
                          dataKey="Thu"
                          stroke="#216b50"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          name="Chi"
                          type="monotone"
                          dataKey="Chi"
                          stroke="#a95234"
                          strokeDasharray="5 3"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={chart} accessibilityLayer>
                        <CartesianGrid vertical={false} stroke="#e2e8e2" />
                        <XAxis dataKey="name" />
                        <YAxis width={55} />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="Thu"
                          fill="#216b50"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="Chi"
                          fill="#a95234"
                          radius={[0, 0, 0, 0]}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
                <details open>
                  <summary>
                    Bảng thu chi{' '}
                    {period === 'month' ? 'theo ngày' : 'theo tháng'}
                  </summary>
                  <div className="table-scroll">
                    <table>
                      <caption className="sr-only">
                        Số tiền thu và chi chính xác theo kỳ
                      </caption>
                      <thead>
                        <tr>
                          <th>{period === 'month' ? 'Ngày' : 'Tháng'}</th>
                          <th className="numeric">Thu nhập</th>
                          <th className="numeric">Chi tiêu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.label}>
                            <td>
                              {period === 'month'
                                ? dateLabel(r.label)
                                : r.label.split('-').reverse().join('/')}
                            </td>
                            <td className="numeric">{money(r.income)}</td>
                            <td className="numeric">{money(r.expense)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </section>
            )}
            {'by_category' in d && d.by_category.length > 0 && (
              <div className="report-grid">
                <section className="panel">
                  <div className="section-heading">
                    <h2>Theo danh mục</h2>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <caption className="sr-only">
                        Tổng thu chi theo danh mục
                      </caption>
                      <thead>
                        <tr>
                          <th>Danh mục</th>
                          <th>Loại</th>
                          <th className="numeric">Số tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.by_category.map((c, i) => (
                          <tr key={i}>
                            <td>{c.name_vi}</td>
                            <td>{c.type === 'income' ? 'Thu' : 'Chi'}</td>
                            <td className="numeric">{money(c.total_vnd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <h2>Ghi chú chi nhiều nhất</h2>
                  </div>
                  <ol className="top-notes">
                    {d.top_notes.map((r, i) => (
                      <li key={i}>
                        <span>{r.note || 'Không có ghi chú'}</span>
                        <strong>{money(r.total_vnd)}</strong>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            )}
            <p className="report-notice">{d.notice}</p>
          </>
        )
      )}
    </>
  );
}
