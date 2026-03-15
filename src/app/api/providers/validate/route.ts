import { NextResponse } from "next/server";
import type { StudioProviderKeyId } from "@/features/studio/types";
import { createStudioRouteError, toStudioErrorResponse } from "@/server/studio/studio-route-errors";

export const runtime = "nodejs";

type ProviderValidationPayload = {
  provider?: StudioProviderKeyId;
  apiKey?: string;
};

function parseProvider(payload: ProviderValidationPayload) {
  const provider = payload.provider?.trim();
  if (
    provider !== "fal" &&
    provider !== "openai" &&
    provider !== "anthropic" &&
    provider !== "gemini"
  ) {
    throw createStudioRouteError(400, "Choose a valid provider.");
  }

  return provider;
}

function parseApiKey(payload: ProviderValidationPayload) {
  const apiKey = payload.apiKey?.trim() ?? "";
  if (!apiKey) {
    throw createStudioRouteError(400, "Enter an API key.");
  }

  if (/\s/.test(apiKey)) {
    throw createStudioRouteError(400, "Enter a valid API key.");
  }

  return apiKey;
}

async function validateProviderKey(provider: StudioProviderKeyId, apiKey: string) {
  switch (provider) {
    case "fal": {
      return fetch("https://rest.alpha.fal.ai/users/current", {
        headers: {
          Authorization: `Key ${apiKey}`,
        },
        cache: "no-store",
      });
    }
    case "openai": {
      return fetch("https://api.openai.com/v1/models?limit=1", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      });
    }
    case "anthropic": {
      return fetch("https://api.anthropic.com/v1/models?limit=1", {
        headers: {
          "anthropic-version": "2023-06-01",
          "x-api-key": apiKey,
        },
        cache: "no-store",
      });
    }
    case "gemini": {
      const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url.searchParams.set("pageSize", "1");
      url.searchParams.set("key", apiKey);

      return fetch(url, {
        cache: "no-store",
      });
    }
    default: {
      throw createStudioRouteError(400, "Choose a valid provider.");
    }
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProviderValidationPayload;
    const provider = parseProvider(payload);
    const apiKey = parseApiKey(payload);
    const response = await validateProviderKey(provider, apiKey);

    if (!response.ok) {
      let providerMessage = "Could not validate that API key.";

      try {
        const errorPayload = (await response.json()) as {
          error?: { message?: string };
          message?: string;
        };
        providerMessage =
          errorPayload.error?.message?.trim() ||
          errorPayload.message?.trim() ||
          providerMessage;
      } catch {
        // Ignore invalid JSON responses.
      }

      throw createStudioRouteError(response.status, providerMessage);
    }

    return NextResponse.json({
      ok: true,
      validatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return toStudioErrorResponse(error, "Could not validate this API key.", 400);
  }
}
