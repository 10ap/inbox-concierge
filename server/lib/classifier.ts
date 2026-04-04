import { createProvider } from "../llm/index.js";

interface ThreadSummary {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

interface Bucket {
  id: string;
  label: string;
  description: string;
}

export interface Classification {
  id: string;
  bucket: string;
  confidence: number;
  reason: string;
}

const BATCH_SIZE = 25;

function buildPrompt(threads: ThreadSummary[], buckets: Bucket[]): string {
  const bucketList = buckets
    .map((b) => `- **${b.id}** ("${b.label}"): ${b.description}`)
    .join("\n");

  const threadList = threads
    .map(
      (t, i) =>
        `### Thread ${i + 1}\n- ID: ${t.id}\n- From: ${t.from}\n- Subject: ${t.subject}\n- Snippet: ${t.snippet}\n- Date: ${t.date}`
    )
    .join("\n\n");

  return `You are an email triage assistant. Classify each email thread into exactly one bucket.

## Available Buckets
${bucketList}

## Threads to Classify
${threadList}

## Instructions
For each thread, respond with a JSON array. Each element must have:
- "id": the thread ID (string)
- "bucket": one of the bucket IDs listed above (string)
- "confidence": your confidence 0-100 (number)
- "reason": a one-sentence explanation (string)

Respond ONLY with the JSON array, no other text or markdown fences.`;
}

function parseResponse(text: string): Classification[] {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code fences
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      return JSON.parse(match[1].trim());
    }
    // Try finding array brackets
    const bracketMatch = text.match(/\[[\s\S]*\]/);
    if (bracketMatch) {
      return JSON.parse(bracketMatch[0]);
    }
    throw new Error("Could not parse LLM response as JSON");
  }
}

export async function classifyThreads(
  threads: ThreadSummary[],
  buckets: Bucket[]
): Promise<Classification[]> {
  const provider = createProvider();
  const batches: ThreadSummary[][] = [];

  for (let i = 0; i < threads.length; i += BATCH_SIZE) {
    batches.push(threads.slice(i, i + BATCH_SIZE));
  }

  console.log(
    `Classifying ${threads.length} threads in ${batches.length} batches using ${provider.name}`
  );

  const results = await Promise.all(
    batches.map(async (batch, idx) => {
      const prompt = buildPrompt(batch, buckets);
      try {
        const response = await provider.complete(prompt);
        return parseResponse(response);
      } catch (err) {
        console.error(`Batch ${idx} classification failed:`, err);
        // Fallback: assign all threads in this batch to "can_wait"
        return batch.map((t) => ({
          id: t.id,
          bucket: "can_wait",
          confidence: 50,
          reason: "Classification failed — assigned default bucket.",
        }));
      }
    })
  );

  return results.flat();
}
