# Phase 8 user validation

Status: PREPARED; no participants, consent records, quotes or outcomes collected.
Owner runs five sessions with students. Use synthetic examples only. Do not infer
results from automated browser tests. Keep identifiable notes/recordings outside
the repository; participant codes P01–P05 are sufficient for public aggregates.

## Consent to read aloud (Vietnamese)

“Đây là SổChat, dự án portfolio thử nghiệm ghi thu chi bằng tin nhắn. Buổi thử
khoảng 15–20 phút, không phải tư vấn tài chính. Chỉ dùng số tiền và nội dung giả;
không nhập tài khoản ngân hàng, địa chỉ, mật khẩu cá nhân hay dữ liệu tài chính
thật. Nếu bạn bấm phân tích/hỏi AI, nội dung bạn nhập được gửi tới Google Gemini.
Tìm kiếm theo ý nghĩa mặc định tắt; chỉ bật nếu bạn muốn thử và đồng ý gửi ghi chú.
Bạn có thể bỏ qua hoặc dừng bất cứ lúc nào. Tôi sẽ ghi thời gian, lỗi và nhận xét
ẩn danh để cải thiện ứng dụng. Việc ghi âm/quay màn hình cần bạn đồng ý riêng.
Bạn có đồng ý tham gia không?”

Record participation and recording consent separately. No consent => no session.
No recordings by default. Explain that Free Tier provider processing can differ
from paid terms; the demo is strictly for synthetic messages. Delete the temporary
account through Settings at the end. Set a concrete notes/recordings deletion date
with the participant; do not promise deletion from provider logs/backups.

## Moderator procedure

Freeze the deployed commit, money profile and test script before collecting timed
results. Warm the free Render API once and record that this is a warm session;
record a separate cold-start observation if measured. Do not keep free services
artificially awake. Record device/browser and whether moderator assistance was used.
Tell participants: bare monetary 1–999 means thousands (35=35000); explicit units
are recommended. Quantities/calendar values are excluded; always review proposals.

1. Register a disposable account with a synthetic example.test email. Explain
   password rules; do not record their password.
2. Ask the participant to log ten fictional expenses in their own phrasing, review
   and confirm. Include one multi-item message, yesterday, an explicit amount and a
   correction before saving. Do not supply the exact message wording.
3. Open Transactions, locate a row, edit it, verify the result, then delete a
   different row with the themed confirmation. Note any dead clicks or lost input.
4. Read the current month's total/category breakdown and change month/year.
   Participant states what each number means; do not coach the answer.
5. Set a category budget, edit it, switch month and delete only the intended limit.
6. Create a savings goal and add a fictional contribution. Explain that contributions
   are separate from ledger expenses and count immediately, including future dates.
7. Ask one monthly total question and follow its matching-transaction evidence.
   Check that the participant distinguishes AI interpretation from SQL totals.
8. Export CSV and inspect the UTF-8 text/import on their chosen spreadsheet app.
   Record app/locale and actual import behavior, not an assumed Excel success.
9. Ask: “Điều gì làm bạn chậm lại?”, “Bạn có hiểu AI vừa làm gì không?”,
   “Bạn có tự tin sửa thông tin sai trước khi lưu không?”
10. Delete the temporary account, confirm logout and stop recording if consented.

## What to measure

For each task: start/end time (seconds), completed independently / completed with
help / not completed, errors, retries, and a short verbatim quote only if permitted.
Separate network/cold-start time from task time where observed. Predeclare exact
criteria: saved ten intended expenses; correct edited/deleted row; correct report
interpretation against recorded synthetic fixture; one goal/contribution; exported
file downloaded. Compare intended versus saved records only with consent; do not
copy another participant's ledger into logs or the public repository.

No fabricated targets or percentages. Report numerator/denominator and small-sample
caveats. Five sessions identify usability problems; they do not establish market
validation, universal accessibility or statistically representative accuracy.

Use release/USER_SESSION_TEMPLATE.md privately for each session. After observations,
prioritize data loss/wrong amount/wrong ownership first, blocked tasks next, then
copy/layout issues. Any code change means recording the new tested commit.

## Results (owner supplied only)

| Participant | Consent       | Device/browser | Independent tasks / attempted | Critical issues | Notes retained until |
| ----------- | ------------- | -------------- | ----------------------------- | --------------- | -------------------- |
| P01         | NOT COLLECTED | —              | —                             | —               | —                    |
| P02         | NOT COLLECTED | —              | —                             | —               | —                    |
| P03         | NOT COLLECTED | —              | —                             | —               | —                    |
| P04         | NOT COLLECTED | —              | —                             | —               | —                    |
| P05         | NOT COLLECTED | —              | —                             | —               | —                    |

Held-out extraction evaluation is a separate process: release/HELDOUT_PROTOCOL.md.
