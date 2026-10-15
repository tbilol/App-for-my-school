-- Adds the parent role. Kept in its own migration: a new enum value can't be
-- used in the same transaction that adds it, and the next migration uses it.
alter type public.user_role add value if not exists 'parent';
