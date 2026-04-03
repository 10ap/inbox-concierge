import { useMemo, useState } from "react";
import { mockThreads } from "./data/mockThreads";
import type { Thread, BucketId } from "./types/thread";

const BUCKET_LABELS: Record<BucketId, string> = {
  important: "Important",
  needs_reply: "Needs reply",
  can_wait: "Can wait",
  newsletter: "Newsletter",
  auto_archive: "Auto-archive",
  recruiting: "Recruiting",
  receipts: "Receipts",
  travel: "Travel",
};

function App() {
  const [selectedBucket, setSelectedBucket] = useState<BucketId | "all">("all");
  const [selectedThread, setSelectedThread] = useState<Thread | null>(
    mockThreads[0] ?? null
  );

  const bucketCounts = useMemo(() => {
    return mockThreads.reduce<Record<BucketId, number>>((acc, thread) => {
      acc[thread.bucket] = (acc[thread.bucket] || 0) + 1;
      return acc;
    }, {
      important: 0,
      needs_reply: 0,
      can_wait: 0,
      newsletter: 0,
      auto_archive: 0,
      recruiting: 0,
      receipts: 0,
      travel: 0,
    });
  }, []);

  const totalCount = mockThreads.length;

  const threads =
    selectedBucket === "all"
      ? mockThreads
      : mockThreads.filter((thread) => thread.bucket === selectedBucket);

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

          {(Object.keys(BUCKET_LABELS) as BucketId[]).map((bucket) => (
            <BucketButton
              key={bucket}
              label={BUCKET_LABELS[bucket]}
              count={bucketCounts[bucket]}
              active={selectedBucket === bucket}
              onClick={() => setSelectedBucket(bucket)}
            />
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex">
        <section className="flex-1 border-r border-slate-800 flex flex-col">
          <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-medium">
                {selectedBucket === "all" ? "All threads" : BUCKET_LABELS[selectedBucket]}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {threads.length} thread{threads.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex gap-2">
              <button className="text-xs border border-slate-700 rounded-md px-3 py-1.5 hover:bg-slate-800 transition">
                New bucket
              </button>
              <button className="text-xs border border-slate-700 rounded-md px-3 py-1.5 hover:bg-slate-800 transition">
                Reclassify
              </button>
            </div>
          </header>

          <ul className="divide-y divide-slate-800 text-sm">
            {threads.map((thread) => (
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
                      {BUCKET_LABELS[thread.bucket]}
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
                  Bucket: {BUCKET_LABELS[selectedThread.bucket]}
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

export default App;