import pLimit from "p-limit";
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
const BATCH_CONCURRENCY = 2; // max concurrent LLM calls to stay within rate limits
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 15000; // 429s reset per minute; wait 15s before retry

function buildPrompt(threads: ThreadSummary[], buckets: Bucket[]): string {
  const validIds = buckets.map((b) => b.id).join(", ");
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
Return a JSON array with exactly ${threads.length} elements — one per thread, in any order.
Each element must have:
- "id": the thread ID exactly as given (string)
- "bucket": MUST be one of: ${validIds} (string)
- "confidence": integer from 0 to 100 representing classification confidence (number)
- "reason": one sentence explaining why this bucket fits (string)

Respond ONLY with the JSON array. No markdown fences, no explanation text.`;
}

function parseResponse(text: string): unknown[] {
  // Try direct parse first
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  // Try extracting from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const parsed = JSON.parse(fenceMatch[1].trim());
    if (Array.isArray(parsed)) return parsed;
  }
  // Try finding array brackets
  const bracketMatch = text.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    const parsed = JSON.parse(bracketMatch[0]);
    if (Array.isArray(parsed)) return parsed;
  }
  throw new Error("Could not parse LLM response as JSON array");
}

function validateClassification(
  item: unknown,
  allowedBucketIds: Set<string>
): Classification | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;

  const id = typeof obj.id === "string" ? obj.id.trim() : null;
  const bucket = typeof obj.bucket === "string" ? obj.bucket.trim() : null;
  const confidence =
    typeof obj.confidence === "number"
      ? Math.min(100, Math.max(0, Math.round(obj.confidence)))
      : null;
  const reason = typeof obj.reason === "string" ? obj.reason.trim() : null;

  if (!id || !bucket || confidence === null || !reason) return null;
  if (!allowedBucketIds.has(bucket)) {
    console.warn(`LLM returned unknown bucket "${bucket}" for thread ${id} — will fallback`);
    return null;
  }

  return { id, bucket, confidence, reason };
}

async function classifyBatchWithRetry(
  batch: ThreadSummary[],
  buckets: Bucket[],
  batchIdx: number
): Promise<Classification[]> {
  const provider = createProvider();
  const allowedBucketIds = new Set(buckets.map((b) => b.id));
  const prompt = buildPrompt(batch, buckets);

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      console.log(`Batch ${batchIdx}: retry ${attempt}/${MAX_RETRIES}`);
    }

    try {
      const text = await provider.complete(prompt);
      const raw = parseResponse(text);

      // Validate each item — keep valid ones, note invalid ones
      const valid: Classification[] = [];
      const foundIds = new Set<string>();

      for (const item of raw) {
        const c = validateClassification(item, allowedBucketIds);
        if (c) {
          valid.push(c);
          foundIds.add(c.id);
        }
      }

      // Any threads not returned by the LLM get a fallback
      const missing = batch.filter((t) => !foundIds.has(t.id));
      if (missing.length > 0) {
        console.warn(
          `Batch ${batchIdx}: ${missing.length} thread(s) missing from LLM response — applying fallback: ${missing.map((t) => t.id).join(", ")}`
        );
        for (const t of missing) {
          valid.push({
            id: t.id,
            bucket: "can_wait",
            confidence: 40,
            reason: "Not returned by classifier — assigned default bucket.",
          });
        }
      }

      return valid;
    } catch (err) {
      lastError = err;
      console.error(`Batch ${batchIdx} attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
    }
  }

  // All retries exhausted — fall back entire batch
  console.error(
    `Batch ${batchIdx}: all ${MAX_RETRIES + 1} attempts failed. Falling back ${batch.length} threads. Last error:`,
    lastError instanceof Error ? lastError.message : lastError
  );
  return batch.map((t) => ({
    id: t.id,
    bucket: "can_wait",
    confidence: 40,
    reason: "Classification unavailable after retries — assigned default bucket.",
  }));
}

export async function classifyThreads(
  threads: ThreadSummary[],
  buckets: Bucket[]
): Promise<Classification[]> {
  const batches: ThreadSummary[][] = [];
  for (let i = 0; i < threads.length; i += BATCH_SIZE) {
    batches.push(threads.slice(i, i + BATCH_SIZE));
  }

  const provider = createProvider();
  console.log(
    `Classifying ${threads.length} threads in ${batches.length} batch(es) of up to ${BATCH_SIZE} using ${provider.name}`
  );

  const limit = pLimit(BATCH_CONCURRENCY);
  const results = await Promise.all(
    batches.map((batch, idx) => limit(() => classifyBatchWithRetry(batch, buckets, idx)))
  );

  const flat = results.flat();
  const fallbackCount = flat.filter((c) => c.confidence === 40).length;
  if (fallbackCount > 0) {
    console.warn(`Classification complete: ${fallbackCount} thread(s) received fallback assignments`);
  }

  return flat;
}
