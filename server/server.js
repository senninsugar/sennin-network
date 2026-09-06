const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const authRouter = require("./auth");
const appsRouter = require("./apps");

const app = express();

const PORT = Number(process.env.PORT || 3000);

app.use(cors({
  origin: process.env.CLIENT_URL || true,
  credentials: true
}));

app.use(express.json({
  limit: "2mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "2mb"
}));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    name: "Web OS API",
    version: "1.0.0"
  });
});

app.use("/api/auth", authRouter);
app.use("/api/apps", appsRouter);

const distPath = path.join(__dirname, "..", "dist");

app.use(express.static(distPath));

app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      console.error("Failed to send index.html:", err);

      if (!res.headersSent) {
        res.status(404).send("Frontend build not found");
      }
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not Found"
  });
});

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "Internal server error"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web OS server running on 0.0.0.0:${PORT}`);
});
