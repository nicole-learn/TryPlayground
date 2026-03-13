import type { StudioModelDefinition } from "./types";

export const STUDIO_MODEL_CATALOG: StudioModelDefinition[] = [
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    providerLabel: "Google",
    kind: "image",
    section: "images",
    description:
      "Fast still-image generation with the same control surface as the current app page.",
    heroGradient: "from-orange-400/25 via-amber-300/10 to-transparent",
    tags: ["Image", "Featured", "Reference-ready"],
    promptPlaceholder: "Describe the image you want to create...",
    supportsNegativePrompt: false,
    supportsReferences: true,
    maxReferenceFiles: 10,
    acceptedReferenceKinds: ["image"],
    aspectRatioOptions: [
      "1:1",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "3:2",
      "2:3",
      "21:9",
      "9:21",
      "auto",
    ],
    resolutionOptions: ["1K", "2K", "4K"],
    outputFormatOptions: ["png", "jpeg", "webp"],
    defaultDraft: {
      prompt: "",
      negativePrompt: "",
      aspectRatio: "1:1",
      resolution: "1K",
      outputFormat: "png",
      imageCount: 1,
      durationSeconds: 6,
      includeAudio: true,
      tone: "Balanced",
      maxTokens: 2048,
      temperature: 0.7,
    },
  },
  {
    id: "veo-3.1",
    name: "Veo 3.1",
    providerLabel: "Google",
    kind: "video",
    section: "videos",
    description:
      "Narrative video generation with the same duration, ratio, resolution, and audio controls as the current app page.",
    heroGradient: "from-sky-400/25 via-cyan-300/10 to-transparent",
    tags: ["Video", "Featured", "Audio"],
    promptPlaceholder: "Describe the video you want to generate...",
    supportsNegativePrompt: true,
    supportsReferences: true,
    maxReferenceFiles: 3,
    acceptedReferenceKinds: ["image"],
    aspectRatioOptions: ["16:9", "9:16"],
    resolutionOptions: ["720p", "1080p", "4K"],
    durationOptions: [4, 6, 8],
    defaultDraft: {
      prompt: "",
      negativePrompt: "",
      aspectRatio: "16:9",
      resolution: "1080p",
      outputFormat: "mp4",
      imageCount: 1,
      durationSeconds: 6,
      includeAudio: true,
      tone: "Balanced",
      maxTokens: 2048,
      temperature: 0.7,
    },
  },
  {
    id: "gemini-flash",
    name: "Gemini 3.0 Flash",
    providerLabel: "Gemini",
    kind: "text",
    section: "text",
    description:
      "Fast text and multimodal prompting with the same prompt-first surface as the current app page.",
    heroGradient: "from-indigo-400/25 via-blue-300/10 to-transparent",
    tags: ["Text", "Featured", "Multimodal"],
    promptPlaceholder: "Write your prompt...",
    supportsNegativePrompt: false,
    supportsReferences: true,
    maxReferenceFiles: 10,
    acceptedReferenceKinds: ["image", "video", "audio", "document"],
    defaultDraft: {
      prompt: "",
      negativePrompt: "",
      aspectRatio: "1:1",
      resolution: "",
      outputFormat: "text",
      imageCount: 1,
      durationSeconds: 6,
      includeAudio: false,
      tone: "Balanced",
      maxTokens: 32000,
      temperature: 0.7,
    },
  },
];

export const STUDIO_MODEL_SECTIONS = [
  {
    id: "images",
    title: "Images",
    description: "Image generation models",
  },
  {
    id: "videos",
    title: "Videos",
    description: "Video generation models",
  },
  {
    id: "text",
    title: "Text",
    description: "LLM text and multimodal models",
  },
] as const;

export function getStudioModelById(modelId: string) {
  return (
    STUDIO_MODEL_CATALOG.find((model) => model.id === modelId) ??
    STUDIO_MODEL_CATALOG[0]
  );
}
