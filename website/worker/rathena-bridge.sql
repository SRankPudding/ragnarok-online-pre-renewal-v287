CREATE TABLE IF NOT EXISTS portal_jobs (
    id CHAR(32) PRIMARY KEY,
    status ENUM('created', 'taken') NOT NULL
) ENGINE=InnoDB;

CREATE OR REPLACE SQL SECURITY DEFINER VIEW portal_roster AS
SELECT account.userid AS username, COALESCE(MAX(character_row.online), 0) AS online
FROM login AS account
LEFT JOIN `char` AS character_row ON character_row.account_id = account.account_id
WHERE account.account_id >= 2000000 AND account.sex <> 'S'
GROUP BY account.account_id, account.userid;
