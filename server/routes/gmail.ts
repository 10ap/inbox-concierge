import { Router } from "express";
import { fetchThreads } from "../lib/gmail.js";

export const gmailRouter = Router();

gmailRouter.get("/threads", async (req, res) => {
  const tokens = (req.session as any).tokens;
  if (!tokens) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const threads = await fetchThreads(tokens);
    res.json({ threads });
  } catch (err: any) {
    console.error("Gmail fetch error:", err.message, err.stack);
    res.status(500).json({ error: "Failed to fetch threads", detail: err.message });
  }
});
