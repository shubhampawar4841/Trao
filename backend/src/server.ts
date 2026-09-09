import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { connectDatabase } from "./config/db";
import authRoutes from "./routes/auth";
import kitRoutes from "./routes/kits";

dotenv.config();

const app = express();

// Needed on Vercel / reverse proxies so secure cookies
// can detect HTTPS via x-forwarded-proto.
app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Trao Interview Kit API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/kits", kitRoutes);

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
