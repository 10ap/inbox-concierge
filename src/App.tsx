import { useState } from "react";
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
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);

  const threads =
    selectedBucket === "all"
      ? mockThreads
      : mockThreads.filter((t) => t.bucket === selectedBucket);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-64 border-r border-slate-800 p-4 flex flex-col gap-4">
        <h1 className="text-lg font-semibold tracking-tight">Inbox Concierge</h1>

        <button className="w-full rounded-md bg-emerald-500 hover:bg-emerald-400 text-sm font-medium py-2 text-slate-950">
          Connect Gmail
        </button>

        <nav className="text-sm space-y-1">
          <BucketButton
            label="All"
            active={selectedBucket === "all"}
            onClick={() => setSelectedBucket("all")}
          />
          {(Object.keys(BUCKET_LABELS) as BucketId[]).map((bucket) => (
            <BucketButton
              key={bucket}
              label={BUCKET_LABELS[bucket]}
              active={selectedBucket === bucket}
              onClick={() => setSelectedBucket(bucket)}
            />
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex">
        <section className="flex-1 border-r border-slate-800 flex flex-col">
          <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h2 className="text-sm font-medium">
              {selectedBucket === "all" ? "All threads" : BUCKET_LABELS[selectedBucket]}
            </h2>
            <div className="flex gap-2">
              <button className="text-xs border border-slate-700 rounded-md px-2 py-1 hover:bg-slate-800">
                New bucket
              </button>
              <button className="text-xs border border-slate-700 rounded-md px-2 py-1 hover:bg-slate-800">
                Reclassify
              </button>
            </div>
          </header>

          <ul className="divide-y divide-slate-800 text-sm">
            {threads.map((thread) => (
              <li
                key={thread.id}
                className="px-4 py-3 hover:bg-slate-900 cursor-pointer"
                onClick={() => setSelectedThread(thread)}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium truncate">{thread.subject}</span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(thread.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between gap-2 mt-1">
                  <span className="text-xs text-slate-400 truncate">{thread.from}</span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    {BUCKET_LABELS[thread.bucket]}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{thread.snippet}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="w-80 p-4 hidden md:block">
          {selectedThread ? (
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold">{selectedThread.subject}</h3>
              <p className="text-xs text-slate-400">From: {selectedThread.from}</p>
              <p className="text-xs text-slate-400">
                Bucket: {BUCKET_LABELS[selectedThread.bucket]}
              </p>
              <p className="text-xs text-slate-400">
                Date: {new Date(selectedThread.date).toLocaleString()}
              </p>
              <p className="text-sm text-slate-300 mt-3">{selectedThread.snippet}</p>
              <div className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500">
                Classification rationale will go here later.
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
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
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={
        "w-full text-left px-3 py-2 rounded-md " +
        (active
          ? "bg-slate-800 text-slate-50"
          : "text-slate-300 hover:bg-slate-900")
      }
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export default App;