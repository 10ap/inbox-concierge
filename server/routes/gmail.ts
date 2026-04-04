import { Router } from "express";
import { fetchThreads } from "../lib/gmail.js";

export const gmailRouter = Router();

gmailRouter.get("/threads", async (req, res) => {
  const tokens = req.session.tokens;
  if (!tokens) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const threads = await fetchThreads(tokens);
    res.json({ threads });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Gmail fetch error:", message);
    res.status(500).json({ error: "Failed to fetch threads", detail: message });
  }
});
