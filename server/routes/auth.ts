import { Router } from "express";
import { google } from "googleapis";
import crypto from "crypto";

export const authRouter = Router();

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/api/auth/google/callback"
  );
}

authRouter.get("/google", (req, res) => {
  const oauth2Client = createOAuth2Client();
  const state = crypto.randomBytes(16).toString("hex");
  (req.session as any).oauthState = state;

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "openid",
      "email",
      "profile",
    ],
    state,
  });

  res.redirect(url);
});

authRouter.get("/google/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code || state !== (req.session as any).oauthState) {
    return res.redirect("/?auth=error");
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    (req.session as any).tokens = tokens;
    (req.session as any).email = userInfo.email;

    res.redirect("/?auth=success");
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.redirect("/?auth=error");
  }
});

authRouter.get("/status", (req, res) => {
  const tokens = (req.session as any).tokens;
  if (tokens) {
    res.json({ authenticated: true, email: (req.session as any).email });
  } else {
    res.json({ authenticated: false });
  }
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});
