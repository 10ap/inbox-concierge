import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { authRouter } from "./routes/auth.js";
import { gmailRouter } from "./routes/gmail.js";
import { classifyRouter } from "./routes/classify.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === "production";

// Trust Render's reverse proxy so secure cookies work behind TLS termination
if (isProd) {
  app.set("trust proxy", 1);
}

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json({ limit: "2mb" }));

const sessionSecret = process.env.SESSION_SECRET;
if (isProd && !sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required in production");
}

app.use(
  session({
    secret: sessionSecret || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/gmail", gmailRouter);
app.use("/api", classifyRouter);

// In production, serve the built frontend
if (isProd) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.use(express.static(path.join(__dirname, "../dist")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
