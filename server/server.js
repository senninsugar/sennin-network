const express = require("express");

const app = express();

const PORT = Number(process.env.PORT || 3000);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "sennin network",
    port: PORT
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SERVER READY: 0.0.0.0:${PORT}`);
});
