-- The game has no guess limit, so guess numbers and counts can exceed the
-- original 50. Widen both checks to match MAX_GUESS_NUMBER in
-- supabase/functions/track/validate.ts.
alter table public.events drop constraint events_guess_number_check;
alter table public.events add constraint events_guess_number_check check (guess_number between 1 and 500);
alter table public.events drop constraint events_guess_count_check;
alter table public.events add constraint events_guess_count_check check (guess_count between 1 and 500);
