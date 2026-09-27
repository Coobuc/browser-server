const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Allow your Cookbuc front end to call this API.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Main API information
app.get("/", (req, res) => {
  res.json({
    name: "Cookbuc Backend",
    version: "1.0",
    status: "online",
    services: ["browser", "games"]
  });
});

// Used by Cookbuc to check whether the server is awake.
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    online: true
  });
});

// Browser configuration
app.get("/api/browser", (req, res) => {
  res.json({
    name: "Cookbuc Browser 1.0",
    status: "ready"
  });
});

// Game library.
// Later we can add permitted web-game URLs here.
app.get("/api/games", (req, res) => {
  res.json({
    games: []
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Cookbuc Backend running on port ${PORT}`);
});
