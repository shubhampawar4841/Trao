import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { connectDatabase } from "./config/db";
import authRoutes from "./routes/auth";
import kitRoutes from "./routes/kits";
dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    origin: "https://trao-frontend-tau.vercel.app",
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

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

app.use("/api/auth", authRoutes);
app.use("/api/kits", kitRoutes);

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});