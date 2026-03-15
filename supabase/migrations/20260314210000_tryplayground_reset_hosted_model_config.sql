update public.studio_accounts
set
  enabled_model_ids = array[
    'nano-banana-2',
    'gemini-3.0-flash',
    'veo-3.1',
    'claude-opus-4.6'
  ]::text[],
  selected_model_id = case
    when selected_model_id = any (
      array[
        'nano-banana-2',
        'gemini-3.0-flash',
        'veo-3.1',
        'claude-opus-4.6'
      ]::text[]
    )
    then selected_model_id
    else 'nano-banana-2'
  end,
  updated_at = timezone('utc', now()),
  revision = revision + 1;
