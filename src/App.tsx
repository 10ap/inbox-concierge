import { useMemo, useState } from "react";
import { mockThreads } from "./data/mockThreads";
import type { Thread, BucketId, DefaultBucketId } from "./types/thread";

const DEFAULT_BUCKETS: { id: DefaultBucketId; label: string }[] = [
  { id: "important", label: "Important" },
  { id: "needs_reply", label: "Needs reply" },
  { id: "can_wait", label: "Can wait" },
  { id: "newsletter", label: "Newsletter" },
  { id: "auto_archive", label: "Auto-archive" },
  { id: "recruiting", label: "Recruiting" },
  { id: "receipts", label: "Receipts" },
  { id: "travel", label: "Travel" },
];

type CustomBucket = {
  id: string;
  label: string;
};

function App() {
  const [threads, setThreads] = useState<Thread[]>(mockThreads);
  const [selectedBucket, setSelectedBucket] = useState<BucketId | "all">("all");
  const [selectedThread, setSelectedThread] = useState<Thread | null>(
    mockThreads[0] ?? null
  );

  const [customBuckets, setCustomBuckets] = useState<CustomBucket[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");

  const allBuckets = [...DEFAULT_BUCKETS, ...customBuckets];

  const bucketLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    allBuckets.forEach((bucket) => {
      map[bucket.id] = bucket.label;
    });
    return map;
  }, [allBuckets]);

  const bucketCounts = useMemo(() => {
    return threads.reduce<Record<string, number>>((acc, thread) => {
      acc[thread.bucket] = (acc[thread.bucket] || 0) + 1;
      return acc;
    }, {});
  }, [threads]);

  const totalCount = threads.length;

  const filteredThreads =
    selectedBucket === "all"
      ? threads
      : threads.filter((thread) => thread.bucket === selectedBucket);

  function formatBucketLabel(bucketId: string) {
    return bucketLabelMap[bucketId] ?? prettifyBucketId(bucketId);
  }

  function createBucketId(label: string) {
    return label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "_");
  }

  function handleCreateBucket() {
    const trimmed = newBucketName.trim();
    if (!trimmed) return;

    const id = createBucketId(trimmed);
    const alreadyExists = allBuckets.some((bucket) => bucket.id === id);

    if (alreadyExists) {
      setIsModalOpen(false);
      setNewBucketName("");
      setSelectedBucket(id);
      return;
    }

    const newBucket = { id, label: trimmed };
    setCustomBuckets((prev) => [...prev, newBucket]);
    setSelectedBucket(id);
    setIsModalOpen(false);
    setNewBucketName("");
  }

  function handleReclassify() {
    if (customBuckets.length === 0) return;

    const updatedThreads = threads.map((thread) => {
      const haystack = `${thread.subject} ${thread.snippet} ${thread.from}`.toLowerCase();

      for (const bucket of customBuckets) {
        const keywords = getKeywordsForBucket(bucket);

        const matchedKeyword = keywords.find((keyword) =>
          haystack.includes(keyword.toLowerCase())
        );

        if (matchedKeyword) {
          return {
            ...thread,
            bucket: bucket.id,
            confidence: 88,
            reason: `Matched custom bucket "${bucket.label}" based on keyword "${matchedKeyword}".`,
          };
        }
      }

      return thread;
    });

    setThreads(updatedThreads);

    if (selectedThread) {
      const refreshedSelectedThread = updatedThreads.find(
        (thread) => thread.id === selectedThread.id
      );
      setSelectedThread(refreshedSelectedThread ?? null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-72 border-r border-slate-800 p-4 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inbox Concierge</h1>
          <p className="text-sm text-slate-400 mt-1">
            AI inbox triage for busy operators
          </p>
        </div>

        <button className="w-full rounded-md bg-emerald-500 hover:bg-emerald-400 text-sm font-medium py-2 text-slate-950 transition">
          Connect Gmail
        </button>

        <nav className="text-sm space-y-1">
          <BucketButton
            label="All"
            count={totalCount}
            active={selectedBucket === "all"}
            onClick={() => setSelectedBucket("all")}
          />

          {allBuckets.map((bucket) => (
            <BucketButton
              key={bucket.id}
              label={bucket.label}
              count={bucketCounts[bucket.id] ?? 0}
              active={selectedBucket === bucket.id}
              onClick={() => setSelectedBucket(bucket.id)}
            />
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex">
        <section className="flex-1 border-r border-slate-800 flex flex-col">
          <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-medium">
                {selectedBucket === "all"
                  ? "All threads"
                  : formatBucketLabel(selectedBucket)}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {filteredThreads.length} thread{filteredThreads.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                className="text-xs border border-slate-700 rounded-md px-3 py-1.5 hover:bg-slate-800 transition"
                onClick={() => setIsModalOpen(true)}
              >
                New bucket
              </button>
              <button
                className="text-xs border border-slate-700 rounded-md px-3 py-1.5 hover:bg-slate-800 transition"
                onClick={handleReclassify}
              >
                Reclassify
              </button>
            </div>
          </header>

          <ul className="divide-y divide-slate-800 text-sm">
            {filteredThreads.map((thread) => (
              <li
                key={thread.id}
                className={`px-4 py-4 cursor-pointer transition hover:bg-slate-900 ${
                  selectedThread?.id === thread.id ? "bg-slate-900/70" : ""
                }`}
                onClick={() => setSelectedThread(thread)}
              >
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{thread.subject}</span>
                      {thread.unread && (
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-slate-400 truncate mt-1">{thread.from}</p>
                    <p className="text-xs text-slate-500 truncate mt-1">{thread.snippet}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400">
                      {new Date(thread.date).toLocaleDateString()}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-2">
                      {formatBucketLabel(thread.bucket)}
                    </p>
                    <p className="text-[11px] text-emerald-400 mt-1">
                      {thread.confidence}% confidence
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="w-96 p-5 hidden md:block">
          {selectedThread ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold leading-tight">
                  {selectedThread.subject}
                </h3>
                <p className="text-sm text-slate-400 mt-2">
                  From: {selectedThread.from}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Bucket: {formatBucketLabel(selectedThread.bucket)}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Date: {new Date(selectedThread.date).toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Snippet
                </p>
                <p className="text-sm text-slate-200 mt-2">{selectedThread.snippet}</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Classification confidence
                </p>
                <p className="text-2xl font-semibold text-emerald-400 mt-2">
                  {selectedThread.confidence}%
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Why this bucket
                </p>
                <p className="text-sm text-slate-300 mt-2">{selectedThread.reason}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Select a thread to see details and classification rationale.
            </p>
          )}
        </section>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold">Create new bucket</h3>
            <p className="text-sm text-slate-400 mt-1">
              Add a custom category, then click Reclassify.
            </p>

            <div className="mt-4">
              <label className="text-xs uppercase tracking-wide text-slate-500">
                Bucket name
              </label>
              <input
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                placeholder="e.g. Finance, Friends, Fitness"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-900"
                onClick={() => {
                  setIsModalOpen(false);
                  setNewBucketName("");
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
                onClick={handleCreateBucket}
              >
                Create bucket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BucketButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`w-full text-left px-3 py-2.5 rounded-md flex items-center justify-between transition ${
        active
          ? "bg-slate-800 text-slate-50"
          : "text-slate-300 hover:bg-slate-900"
      }`}
      onClick={onClick}
    >
      <span>{label}</span>
      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
        {count}
      </span>
    </button>
  );
}

function prettifyBucketId(bucketId: string) {
  return bucketId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getKeywordsForBucket(bucket: CustomBucket) {
  const labelWords = bucket.label
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);

  const baseKeywords = [bucket.label.toLowerCase(), bucket.id.toLowerCase(), ...labelWords];

  const specialKeywords: Record<string, string[]> = {
    finance: ["invoice", "billing", "receipt", "payment", "expense", "charge"],
    fitness: ["workout", "gym", "training", "classpass", "run", "health"],
    friends: ["birthday", "dinner", "weekend", "hang", "party", "plans"],
    family: ["mom", "dad", "family", "cousin", "aunt", "uncle"],
    recruiting: ["interview", "recruiter", "application", "greenhouse", "ashby", "candidate"],
    travel: ["flight", "hotel", "itinerary", "trip", "booking", "airbnb"],
  };

  const extra = specialKeywords[bucket.id] ?? [];
  return [...new Set([...baseKeywords, ...extra])];
}

export default App;