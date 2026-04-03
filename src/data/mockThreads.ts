import type { Thread } from "../types/thread";

export const mockThreads: Thread[] = [
  {
    id: "1",
    from: "recruiter@company.com",
    subject: "Interview loop – next steps",
    snippet: "Thanks again for taking the time to chat. We'd like to move you forward...",
    date: "2026-04-01T15:30:00Z",
    unread: true,
    bucket: "important",
  },
  {
    id: "2",
    from: "jobs-noreply@linkedin.com",
    subject: "New jobs that match your profile",
    snippet: "Here are this week's recommended roles based on your preferences...",
    date: "2026-04-01T08:10:00Z",
    unread: false,
    bucket: "newsletter",
  },
  {
    id: "3",
    from: "support@delta.com",
    subject: "Your flight to NYC – itinerary",
    snippet: "Thank you for choosing Delta. Your upcoming trip details are below...",
    date: "2026-03-31T11:45:00Z",
    unread: true,
    bucket: "travel",
  },
  {
    id: "4",
    from: "billing@amazon.com",
    subject: "Your receipt for recent order",
    snippet: "Thanks for shopping with us. Your receipt is attached...",
    date: "2026-03-30T10:15:00Z",
    unread: false,
    bucket: "receipts",
  },
];