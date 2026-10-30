import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { config } from "@/lib/config";

// Klíč se čte z ANTHROPIC_API_KEY
export const anthropic = new Anthropic();

type Effort = "low" | "medium" | "high";

/**
 * Jedno volání Clauda se strukturovaným výstupem (validace přes Zod).
 * Při odmítnutí (stop_reason "refusal") server automaticky zkusí záložní model,
 * pokud je zapnuté ANTHROPIC_FALLBACKS.
 */
export async function structuredCall<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  prompt: string;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const response = await anthropic.beta.messages.parse({
    model: config.ai.model,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: {
      effort: opts.effort ?? "high",
      format: betaZodOutputFormat(opts.schema),
    },
    ...(config.ai.useFallbacks
      ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
      : {}),
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `AI požadavek odmítla (${response.stop_details?.category ?? "bez kategorie"}). Zkus upravit vstup.`,
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("AI odpověď byla useknuta (max_tokens) – zvyš limit.");
  }
  if (!response.parsed_output) {
    throw new Error("AI nevrátila platný strukturovaný výstup.");
  }
  return response.parsed_output as z.infer<S>;
}
