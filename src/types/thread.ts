export type DefaultBucketId =
  | "important"
  | "needs_reply"
  | "can_wait"
  | "newsletter"
  | "auto_archive"
  | "recruiting"
  | "receipts"
  | "travel";

export type BucketId = DefaultBucketId | string;

export interface Thread {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  bucket: BucketId;
  confidence: number;
  reason: string;
}