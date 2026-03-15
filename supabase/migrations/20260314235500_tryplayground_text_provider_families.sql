alter table public.generation_runs
  drop constraint if exists generation_runs_provider_check;

alter table public.generation_runs
  add constraint generation_runs_provider_check
  check (provider in ('fal', 'openai', 'anthropic', 'google'));

alter table public.library_items
  drop constraint if exists library_items_provider_check;

alter table public.library_items
  add constraint library_items_provider_check
  check (provider in ('fal', 'openai', 'anthropic', 'google'));

alter table public.studio_accounts
  alter column enabled_model_ids
  set default array[
    'nano-banana-2',
    'veo-3.1',
    'gpt-5.4',
    'gpt-5.2',
    'gpt-5-mini',
    'claude-opus-4.1',
    'claude-sonnet-4',
    'claude-haiku-3.5',
    'gemini-3-pro-preview',
    'gemini-3-flash',
    'gemini-2.5-flash-lite'
  ]::text[];

update public.studio_accounts
set
  enabled_model_ids = array[
    'nano-banana-2',
    'veo-3.1',
    'gpt-5.4',
    'gpt-5.2',
    'gpt-5-mini',
    'claude-opus-4.1',
    'claude-sonnet-4',
    'claude-haiku-3.5',
    'gemini-3-pro-preview',
    'gemini-3-flash',
    'gemini-2.5-flash-lite'
  ]::text[],
  selected_model_id = case
    when selected_model_id = 'gpt-5.1' then 'gpt-5.2'
    when selected_model_id = 'claude-opus-4.6' then 'claude-opus-4.1'
    when selected_model_id = 'claude-sonnet-4.6' then 'claude-sonnet-4'
    when selected_model_id = 'claude-haiku-4.5' then 'claude-haiku-3.5'
    when selected_model_id in ('gemini-3.0-flash', 'gemini-3-flash-preview') then 'gemini-3-flash'
    when selected_model_id in (
      'nano-banana-2',
      'veo-3.1',
      'gpt-5.4',
      'gpt-5.2',
      'gpt-5-mini',
      'claude-opus-4.1',
      'claude-sonnet-4',
      'claude-haiku-3.5',
      'gemini-3-pro-preview',
      'gemini-3-flash',
      'gemini-2.5-flash-lite'
    ) then selected_model_id
    else 'nano-banana-2'
  end,
  updated_at = timezone('utc', now()),
  revision = revision + 1;

update public.generation_runs
set
  model_id = case
    when model_id = 'gpt-5.1' then 'gpt-5.2'
    when model_id = 'claude-opus-4.6' then 'claude-opus-4.1'
    when model_id = 'claude-sonnet-4.6' then 'claude-sonnet-4'
    when model_id = 'claude-haiku-4.5' then 'claude-haiku-3.5'
    when model_id in ('gemini-3.0-flash', 'gemini-3-flash-preview') then 'gemini-3-flash'
    else model_id
  end,
  model_name = case
    when model_id = 'gpt-5.1' then 'GPT-5.2'
    when model_id = 'claude-opus-4.6' then 'Claude Opus 4.1'
    when model_id = 'claude-sonnet-4.6' then 'Claude Sonnet 4'
    when model_id = 'claude-haiku-4.5' then 'Claude Haiku 3.5'
    when model_id in ('gemini-3.0-flash', 'gemini-3-flash-preview') then 'Gemini 3 Flash'
    else model_name
  end,
  updated_at = timezone('utc', now())
where model_id in (
  'gpt-5.1',
  'claude-opus-4.6',
  'claude-sonnet-4.6',
  'claude-haiku-4.5',
  'gemini-3.0-flash',
  'gemini-3-flash-preview'
);

update public.library_items
set
  model_id = case
    when model_id = 'gpt-5.1' then 'gpt-5.2'
    when model_id = 'claude-opus-4.6' then 'claude-opus-4.1'
    when model_id = 'claude-sonnet-4.6' then 'claude-sonnet-4'
    when model_id = 'claude-haiku-4.5' then 'claude-haiku-3.5'
    when model_id in ('gemini-3.0-flash', 'gemini-3-flash-preview') then 'gemini-3-flash'
    else model_id
  end,
  updated_at = timezone('utc', now())
where model_id in (
  'gpt-5.1',
  'claude-opus-4.6',
  'claude-sonnet-4.6',
  'claude-haiku-4.5',
  'gemini-3.0-flash',
  'gemini-3-flash-preview'
);
