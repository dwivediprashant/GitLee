import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config, validateConfig } from "./config/index.js";
import { connectDB } from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import githubRoutes from "./routes/githubRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import syncRoutes from "./routes/syncRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const allowedOrigins = new Set([config.cors.clientUrl]);
if (config.cors.extensionId)
  allowedOrigins.add(`chrome-extension://${config.cors.extensionId}`);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(
        new Error("Origin is not allowed by GitLee CORS policy"),
      );
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/sync", syncRoutes);
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  validateConfig();
  connectDB().then(() =>
    app.listen(config.port, () =>
      console.log(`[GitLee] Server listening on ${config.port}`),
    ),
  );
}
export default app;
