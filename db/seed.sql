-- Fixed deterministic hash seed. User, income type and day vary independently.
INSERT INTO users(email,password_hash,display_name)
SELECT 'synthetic'||g||'@example.test','not-a-password','Synthetic '||g FROM generate_series(1,1000) g;
INSERT INTO transactions(user_id,type,amount_vnd,category_id,occurred_on)
SELECT 1+(g%1000), CASE WHEN (g/1000)%10=0 THEN 'income'::txn_type ELSE 'expense'::txn_type END,
1000+abs(('x'||substr(md5('sochat-seed-20261103-'||g),1,8))::bit(32)::bigint)%500001,
CASE WHEN (g/1000)%10=0 THEN 10+(g%4) ELSE 1+(g%9) END,
DATE '2024-01-01'+(abs(('x'||substr(md5('sochat-date-20261103-'||g),1,8))::bit(32)::bigint)%1035)::int
FROM generate_series(1,:rows::bigint) g;
