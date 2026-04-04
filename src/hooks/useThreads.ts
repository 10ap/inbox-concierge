import { useCallback, useState } from "react";
import type { Thread, BucketId } from "../types/thread";

interface GmailThread {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}

interface Bucket {
  id: BucketId;
  label: string;
  description: string;
}

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [rawThreads, setRawThreads] = useState<GmailThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAndClassify = useCallback(async (buckets: Bucket[]) => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Fetch threads from Gmail
      const gmailRes = await fetch("/api/gmail/threads", {
        credentials: "include",
      });

      if (!gmailRes.ok) {
        throw new Error("Failed to fetch Gmail threads");
      }

      const { threads: gmailThreads } = (await gmailRes.json()) as {
        threads: GmailThread[];
      };
      setRawThreads(gmailThreads);

      // Step 2: Classify threads
      const classified = await classifyThreads(gmailThreads, buckets);
      setThreads(classified);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reclassify = useCallback(
    async (buckets: Bucket[]) => {
      if (rawThreads.length === 0) return;

      setIsLoading(true);
      setError(null);

      try {
        const classified = await classifyThreads(rawThreads, buckets);
        setThreads(classified);
      } catch (err: any) {
        setError(err.message || "Reclassification failed");
      } finally {
        setIsLoading(false);
      }
    },
    [rawThreads]
  );

  return { threads, isLoading, error, fetchAndClassify, reclassify };
}

async function classifyThreads(
  gmailThreads: GmailThread[],
  buckets: Bucket[]
): Promise<Thread[]> {
  const classifyRes = await fetch("/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      threads: gmailThreads.map((t) => ({
        id: t.id,
        from: t.from,
        subject: t.subject,
        snippet: t.snippet,
        date: t.date,
      })),
      buckets: buckets.map((b) => ({
        id: b.id,
        label: b.label,
        description: b.description,
      })),
    }),
  });

  if (!classifyRes.ok) {
    throw new Error("Classification failed");
  }

  const { classifications } = await classifyRes.json();

  // Merge Gmail data with classification results
  const classMap = new Map(
    classifications.map((c: any) => [c.id, c])
  );

  return gmailThreads.map((t) => {
    const c = classMap.get(t.id);
    return {
      id: t.id,
      from: t.from,
      subject: t.subject,
      snippet: t.snippet,
      date: t.date,
      unread: t.unread,
      bucket: c?.bucket || "can_wait",
      confidence: c?.confidence || 50,
      reason: c?.reason || "No classification available.",
    };
  });
}
