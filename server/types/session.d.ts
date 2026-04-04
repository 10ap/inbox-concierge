import type { Credentials } from "google-auth-library";

declare module "express-session" {
  interface SessionData {
    oauthState?: string;
    tokens?: Credentials;
    email?: string;
  }
}
