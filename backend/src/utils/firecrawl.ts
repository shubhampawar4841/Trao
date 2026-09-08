import Firecrawl from "@mendable/firecrawl-js";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.FIRECRAWL_API_KEY) {
  throw new Error("FIRECRAWL_API_KEY is missing");
}

export const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY,
});