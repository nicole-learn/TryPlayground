alter table public.studio_accounts
alter column enabled_model_ids
set default array[
  'nano-banana-2',
  'gemini-2.5-flash',
  'veo-3.1',
  'claude-opus-4.6'
]::text[];

update public.studio_accounts
set
  enabled_model_ids = array[
    'nano-banana-2',
    'gemini-2.5-flash',
    'veo-3.1',
    'claude-opus-4.6'
  ]::text[],
  updated_at = timezone('utc', now()),
  revision = revision + 1
where enabled_model_ids = array[
  'bria-rmbg-2',
  'claude-opus-4.6',
  'claude-sonnet-4.6',
  'chatterbox-tts',
  'dia-tts',
  'flux-kontext-pro',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gpt-4.1',
  'gpt-5-mini',
  'gpt-oss-120b',
  'kling-o3-pro',
  'kling-video-v3-pro',
  'llama-4-maverick',
  'minimax-speech-2.8-hd',
  'nano-banana-2',
  'orpheus-tts',
  'pixelcut-background-removal',
  'qwen-image-2-pro',
  'recraft-v4-pro',
  'veo-3.1',
  'veo-3.1-fast'
]::text[];
