import { useEffect, useMemo, useState } from "react";
import { mockThreads } from "./data/mockThreads";
import type { Thread, BucketId, DefaultBucketId } from "./types/thread";
import { useAuth } from "./hooks/useAuth";
import { useThreads } from "./hooks/useThreads";

const DEFAULT_BUCKETS: { id: DefaultBucketId; label: string; description: string }[] = [
  { id: "important", label: "Important", description: "High-priority threads needing awareness or action." },
  { id: "needs_reply", label: "Needs reply", description: "Threads that likely require a response." },
  { id: "can_wait", label: "Can wait", description: "Relevant but not urgent." },
  { id: "newsletter", label: "Newsletter", description: "Recurring informational content." },
  { id: "auto_archive", label: "Auto-archive", description: "Low-signal promotional or routine updates." },
  { id: "recruiting", label: "Recruiting", description: "Job applications, recruiters, and interview coordination." },
  { id: "receipts", label: "Receipts", description: "Transactional billing and purchase confirmations." },
  { id: "travel", label: "Travel", description: "Flights, hotels, and itinerary details." },
];

type CustomBucket = {
  id: string;
  label: string;
  description: string;
};

type ToastState = {
  message: string;
  tone: "success" | "info" | "error";
} | null;

function App() {
  const auth = useAuth();
  const { threads: liveThreads, isLoading: isLoadingThreads, error: threadError, fetchAndClassify, reclassify } = useThreads();

  const [threads, setThreads] = useState<Thread[]>(mockThreads);
  const [selectedBucket, setSelectedBucket] = useState<BucketId | "all">("all");
  const [selectedThread, setSelectedThread] = useState<Thread | null>(mockThreads[0] ?? null);
  const [customBuckets, setCustomBuckets] = useState<CustomBucket[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketDescription, setNewBucketDescription] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isReclassifying, setIsReclassifying] = useState(false);

  const allBuckets = [...DEFAULT_BUCKETS, ...customBuckets];

  // When user authenticates, fetch + classify real threads
  useEffect(() => {
    if (auth.isAuthenticated && !auth.isLoading) {
      fetchAndClassify(DEFAULT_BUCKETS);
    }
  }, [auth.isAuthenticated, auth.isLoading, fetchAndClassify]);

  // Sync live threads into state
  useEffect(() => {
    if (liveThreads.length > 0) {
      setThreads(liveThreads);
      setSelectedThread(liveThreads[0] ?? null);
      setSelectedBucket("all");
    }
  }, [liveThreads]);

  // Show error as toast
  useEffect(() => {
    if (threadError) {
      showToast(threadError, "error");
    }
  }, [threadError]);

  // Auto-dismiss toasts
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function showToast(message: string, tone: "success" | "info" | "error" = "info") {
    setToast({ message, tone });
  }

  const bucketLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    allBuckets.forEach((b) => { map[b.id] = b.label; });
    return map;
  }, [allBuckets]);

  const bucketDescriptionMap = useMemo(() => {
    const map: Record<string, string> = {};
    allBuckets.forEach((b) => { map[b.id] = b.description; });
    return map;
  }, [allBuckets]);

  const bucketCounts = useMemo(() => {
    return threads.reduce<Record<string, number>>((acc, t) => {
      acc[t.bucket] = (acc[t.bucket] || 0) + 1;
      return acc;
    }, {});
  }, [threads]);

  const filteredThreads = useMemo(() => {
    const bucketFiltered =
      selectedBucket === "all" ? threads : threads.filter((t) => t.bucket === selectedBucket);
    const query = searchQuery.trim().toLowerCase();
    if (!query) return bucketFiltered;
    return bucketFiltered.filter((t) => {
      const haystack = `${t.subject} ${t.snippet} ${t.from} ${formatBucketLabel(t.bucket)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [threads, selectedBucket, searchQuery, bucketLabelMap]);

  function formatBucketLabel(bucketId: string) {
    return bucketLabelMap[bucketId] ?? prettifyBucketId(bucketId);
  }

  function formatBucketDescription(bucketId: string) {
    return bucketDescriptionMap[bucketId] || "User-defined category for inbox triage.";
  }

  function createBucketId(label: string) {
    return label.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "_");
  }

  function resetModal() {
    setIsModalOpen(false);
    setNewBucketName("");
    setNewBucketDescription("");
  }

  function handleCreateBucket() {
    const trimmedName = newBucketName.trim();
    const trimmedDescription = newBucketDescription.trim();
    if (!trimmedName) return;

    const id = createBucketId(trimmedName);
    const alreadyExists = allBuckets.some((b) => b.id === id);

    if (alreadyExists) {
      setSelectedBucket(id);
      showToast(`Bucket "${trimmedName}" already exists. Switched to it.`, "info");
      resetModal();
      return;
    }

    const newBucket = {
      id,
      label: trimmedName,
      description: trimmedDescription || `Custom bucket for emails related to ${trimmedName.toLowerCase()}.`,
    };

    setCustomBuckets((prev) => [...prev, newBucket]);
    setSelectedBucket(id);
    showToast(`Created bucket "${trimmedName}".`, "success");
    resetModal();
  }

  async function handleReclassify() {
    if (customBuckets.length === 0) {
      showToast("Create a custom bucket first before reclassifying.", "info");
      return;
    }

    setIsReclassifying(true);

    try {
      if (auth.isAuthenticated) {
        // Real reclassification via LLM
        await reclassify(allBuckets);
        showToast("Reclassification complete.", "success");
      } else {
        // Mock reclassification for unauthenticated demo
        applyMockReclassification();
      }
    } finally {
      setIsReclassifying(false);
    }
  }

  function applyMockReclassification() {
    let movedCount = 0;
    const updatedThreads = threads.map((thread) => {
      const haystack = `${thread.subject} ${thread.snippet} ${thread.from}`.toLowerCase();
      for (const bucket of customBuckets) {
        const keywords = getKeywordsForBucket(bucket);
        const matchedKeyword = keywords.find((kw) => haystack.includes(kw.toLowerCase()));
        if (matchedKeyword) {
          if (thread.bucket !== bucket.id) movedCount += 1;
          return {
            ...thread,
            bucket: bucket.id,
            confidence: 88,
            reason: `Matched custom bucket "${bucket.label}" based on keyword "${matchedKeyword}". ${bucket.description}`,
          };
        }
      }
      return thread;
    });

    setThreads(updatedThreads);
    if (selectedThread) {
      setSelectedThread(updatedThreads.find((t) => t.id === selectedThread.id) ?? null);
    }
    showToast(
      movedCount > 0
        ? `Reclassified ${movedCount} thread${movedCount === 1 ? "" : "s"} into custom buckets.`
        : "No additional threads matched your custom bucket rules.",
      movedCount > 0 ? "success" : "info"
    );
  }

  const isLoading = isLoadingThreads || isReclassifying;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-72 border-r border-slate-800 p-4 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inbox Concierge</h1>
          <p className="text-sm text-slate-400 mt-1">AI inbox triage for busy operators</p>
        </div>

        {auth.isLoading ? (
          <div className="h-9 rounded-md bg-slate-800 animate-pulse" />
        ) : auth.isAuthenticated ? (
          <div className="space-y-2">
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
              <p className="text-xs text-emerald-400 font-medium truncate">{auth.email}</p>
              <p className="text-xs text-slate-500 mt-0.5">Gmail connected</p>
            </div>
            <button
              onClick={auth.logout}
              className="w-full text-xs text-slate-500 hover:text-slate-300 text-left px-1 transition"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={auth.login}
            disabled={isLoading}
            className="w-full rounded-md bg-emerald-500 hover:bg-emerald-400 text-sm font-medium py-2 text-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Connect Gmail
          </button>
        )}

        <nav className="text-sm space-y-1">
          <BucketButton
            label="All"
            count={threads.length}
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

      {/* Main */}
      <main className="flex-1 flex">
        {/* Thread list */}
        <section className="flex-1 border-r border-slate-800 flex flex-col">
          <header className="px-4 py-3 border-b border-slate-800 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium">
                  {selectedBucket === "all" ? "All threads" : formatBucketLabel(selectedBucket)}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {filteredThreads.length} result{filteredThreads.length === 1 ? "" : "s"}
                  {searchQuery.trim() ? ` for "${searchQuery}"` : ""}
                </p>
                {selectedBucket !== "all" && (
                  <p className="text-xs text-slate-400 mt-2 max-w-xl">
                    {formatBucketDescription(selectedBucket)}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  disabled={isLoading}
                  className="text-xs border border-slate-700 rounded-md px-3 py-1.5 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setIsModalOpen(true)}
                >
                  New bucket
                </button>
                <button
                  disabled={isLoading}
                  className="text-xs border border-slate-700 rounded-md px-3 py-1.5 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleReclassify}
                >
                  {isReclassifying ? "Reclassifying..." : "Reclassify"}
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject, sender, snippet, or bucket..."
                disabled={isLoading}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-400 disabled:opacity-60"
              />
            </div>
          </header>

          {isLoading ? (
            <div className="divide-y divide-slate-800">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="px-4 py-4 animate-pulse">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="h-4 w-56 rounded bg-slate-800" />
                      <div className="h-3 w-40 rounded bg-slate-900 mt-3" />
                      <div className="h-3 w-72 rounded bg-slate-900 mt-2" />
                    </div>
                    <div className="w-24 shrink-0">
                      <div className="h-3 w-16 ml-auto rounded bg-slate-800" />
                      <div className="h-3 w-20 ml-auto rounded bg-slate-900 mt-3" />
                      <div className="h-3 w-20 ml-auto rounded bg-slate-900 mt-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-slate-800 text-sm overflow-y-auto">
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

              {filteredThreads.length === 0 && (
                <li className="px-4 py-12 text-center">
                  <p className="text-sm text-slate-400">No threads matched your search.</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Try another search term or switch buckets.
                  </p>
                </li>
              )}
            </ul>
          )}
        </section>

        {/* Thread detail */}
        <section className="w-96 p-5 hidden md:block overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div>
                <div className="h-7 w-64 rounded bg-slate-800" />
                <div className="h-4 w-48 rounded bg-slate-900 mt-3" />
                <div className="h-4 w-32 rounded bg-slate-900 mt-2" />
                <div className="h-4 w-40 rounded bg-slate-900 mt-2" />
              </div>
              {[28, 20, 12, 20].map((w, i) => (
                <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="h-3 w-28 rounded bg-slate-800" />
                  <div className={`h-4 w-full rounded bg-slate-900 mt-3`} />
                  <div className={`h-4 w-${w} rounded bg-slate-900 mt-2`} />
                </div>
              ))}
            </div>
          ) : selectedThread ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold leading-tight">{selectedThread.subject}</h3>
                <p className="text-sm text-slate-400 mt-2">From: {selectedThread.from}</p>
                <p className="text-sm text-slate-400 mt-1">
                  Bucket: {formatBucketLabel(selectedThread.bucket)}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Date: {new Date(selectedThread.date).toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Bucket description</p>
                <p className="text-sm text-slate-300 mt-2">
                  {formatBucketDescription(selectedThread.bucket)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Snippet</p>
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
                <p className="text-xs uppercase tracking-wide text-slate-500">Why this bucket</p>
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

      {/* New bucket modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-40">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold">Create new bucket</h3>
            <p className="text-sm text-slate-400 mt-1">
              Add a custom category and a short description for how the assistant should think about it.
            </p>

            <div className="mt-4">
              <label className="text-xs uppercase tracking-wide text-slate-500">Bucket name</label>
              <input
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                placeholder="e.g. Finance, Fitness, Friends"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
                onKeyDown={(e) => e.key === "Enter" && handleCreateBucket()}
              />
            </div>

            <div className="mt-4">
              <label className="text-xs uppercase tracking-wide text-slate-500">Description</label>
              <textarea
                value={newBucketDescription}
                onChange={(e) => setNewBucketDescription(e.target.value)}
                placeholder="e.g. Expenses, invoices, receipts, charges, and billing emails."
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 resize-none"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-900"
                onClick={resetModal}
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`rounded-xl border px-4 py-3 shadow-2xl ${
              toast.tone === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : toast.tone === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-slate-700 bg-slate-900 text-slate-200"
            }`}
          >
            <p className="text-sm font-medium">{toast.message}</p>
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
        active ? "bg-slate-800 text-slate-50" : "text-slate-300 hover:bg-slate-900"
      }`}
      onClick={onClick}
    >
      <span>{label}</span>
      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{count}</span>
    </button>
  );
}

function prettifyBucketId(bucketId: string) {
  return bucketId
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function getKeywordsForBucket(bucket: CustomBucket) {
  const labelWords = bucket.label.toLowerCase().split(/[\s_-]+/).filter(Boolean);
  const descWords = bucket.description.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const base = [bucket.label.toLowerCase(), bucket.id.toLowerCase(), ...labelWords, ...descWords];

  const special: Record<string, string[]> = {
    finance: ["invoice", "billing", "receipt", "payment", "expense", "charge", "uber"],
    fitness: ["workout", "gym", "training", "classpass", "run", "health"],
    friends: ["birthday", "dinner", "weekend", "hang", "party", "plans"],
    family: ["mom", "dad", "family", "cousin", "aunt", "uncle"],
    recruiting: ["interview", "recruiter", "application", "greenhouse", "ashby", "candidate"],
    travel: ["flight", "hotel", "itinerary", "trip", "booking", "airbnb"],
  };

  return [...new Set([...base, ...(special[bucket.id] ?? [])])];
}

export default App;
