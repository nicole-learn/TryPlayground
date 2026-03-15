alter table public.studio_accounts
alter column enabled_model_ids
set default array[
  'nano-banana-2',
  'gemini-3.0-flash',
  'veo-3.1',
  'claude-opus-4.6'
]::text[];

update public.studio_accounts
set
  enabled_model_ids = (
    select array_agg(
      case
        when enabled_model_id = 'gemini-2.5-flash' then 'gemini-3.0-flash'
        else enabled_model_id
      end
      order by ordinality
    )
    from unnest(enabled_model_ids) with ordinality as model_ids(enabled_model_id, ordinality)
  ),
  updated_at = timezone('utc', now()),
  revision = revision + 1
where array_position(enabled_model_ids, 'gemini-2.5-flash') is not null;

update public.studio_accounts
set
  selected_model_id = 'gemini-3.0-flash',
  updated_at = timezone('utc', now()),
  revision = revision + 1
where selected_model_id = 'gemini-2.5-flash';

update public.generation_runs
set
  model_id = 'gemini-3.0-flash',
  model_name = 'Gemini 3.0 Flash'
where model_id = 'gemini-2.5-flash';

update public.library_items
set model_id = 'gemini-3.0-flash'
where model_id = 'gemini-2.5-flash';
