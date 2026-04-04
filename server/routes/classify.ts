import { Router } from "express";
import { classifyThreads } from "../lib/classifier.js";

export const classifyRouter = Router();

classifyRouter.post("/classify", async (req, res) => {
  const { threads, buckets } = req.body;

  if (!threads?.length || !buckets?.length) {
    return res.status(400).json({ error: "threads and buckets are required" });
  }

  try {
    const classifications = await classifyThreads(threads, buckets);
    res.json({ classifications });
  } catch (err: any) {
    console.error("Classification error:", err.message);
    res.status(500).json({ error: "Classification failed" });
  }
});
