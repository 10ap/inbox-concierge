import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import pLimit from "p-limit";

export interface GmailThread {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}

function createOAuth2Client(tokens: any): OAuth2Client {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

function getHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function fetchThreads(tokens: any): Promise<GmailThread[]> {
  const auth = createOAuth2Client(tokens);
  const gmail = google.gmail({ version: "v1", auth });

  // Fetch thread list
  const listRes = await gmail.users.threads.list({
    userId: "me",
    maxResults: 200,
  });

  const threadItems = listRes.data.threads || [];
  if (threadItems.length === 0) return [];

  // Fetch thread details concurrently (limit to 20 at a time)
  const limit = pLimit(20);

  const threads = await Promise.all(
    threadItems.map((item) =>
      limit(async (): Promise<GmailThread | null> => {
        try {
          const threadRes = await gmail.users.threads.get({
            userId: "me",
            id: item.id!,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"],
          });

          const firstMessage = threadRes.data.messages?.[0];
          if (!firstMessage) return null;

          const headers = firstMessage.payload?.headers;
          const unread = firstMessage.labelIds?.includes("UNREAD") ?? false;

          return {
            id: item.id!,
            from: getHeader(headers, "From"),
            subject: getHeader(headers, "Subject") || "(no subject)",
            snippet: item.snippet || threadRes.data.snippet || "",
            date: getHeader(headers, "Date"),
            unread,
          };
        } catch {
          return null;
        }
      })
    )
  );

  return threads.filter((t): t is GmailThread => t !== null);
}
