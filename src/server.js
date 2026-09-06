import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import api from "./routes/api.js";
import { securityMiddleware } from "./middleware/security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("trust proxy", 1);

const port = Number(process.env.PORT || 3000);

securityMiddleware(app);

app.use(express.json({ limit: "300kb" }));
app.use(cookieParser());
app.use(morgan("combined"));

app.use("/api", api);

app.get("/config.js", (_req, res) => {
  res.type("application/javascript").set("Cache-Control", "no-store");
  res.send(`window.SENNIN_CONFIG=${JSON.stringify({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY
  })};`);
});

app.use(express.static(path.join(__dirname, "..", "public"), {
  extensions: ["html"],
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

app.get("*splat", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(port, () => {
  console.log(`Sennin Network OS listening on http://localhost:${port}`);
});
