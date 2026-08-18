-- The audit trail must outlive the row it describes: drop the cascading FK so deleting a
-- (still-proposed) recommendation in the nightly refresh never erases who did what.
alter table enforcement_status_log drop constraint if exists enforcement_status_log_rec_id_fkey;
