import { NextResponse } from "next/server";

// TEMPORARY diagnostic route — not part of the shipped feature set.
// Replicates lib/summarize.ts's exact request shape (systemInstruction +
// responseSchema structured output), which a bare prompt call doesn't
// exercise, to isolate why /api/summarize keeps returning source:fallback
// even with a working key and a valid model. Delete once diagnosed.
export const dynamic = "force-dynamic";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    themes: {
      type: "ARRAY",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          detail: { type: "STRING" },
          sentiment: { type: "STRING", enum: ["positive", "mixed", "negative"] },
          mentions: { type: "INTEGER" },
        },
        required: ["label", "detail", "sentiment", "mentions"],
      },
    },
  },
  required: ["themes"],
};

export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  const info: Record<string, unknown> = { hasKey: !!key };
  if (!key) return NextResponse.json(info);

  try {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You extract themes from reviews. Return JSON only." }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Reviews:\n[5] Great fit, true to size.\n[2] Fabric felt thin and see-through.\n[4] Colour matched the photos exactly.",
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
    info.httpStatus = res.status;
    const text = await res.text();
    info.bodyPreview = text.slice(0, 800);
  } catch (e) {
    info.fetchError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(info);
}
