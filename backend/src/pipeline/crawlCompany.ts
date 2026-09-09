import axios from "axios";
import * as cheerio from "cheerio";
import dns from "node:dns/promises";
import net from "node:net";
import robotsParser from "robots-parser";

import { withHttpRetry } from "../utils/httpRetry";

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  score: number;
}

export interface CrawlResult {
  homepage: CrawledPage;
  pages: CrawledPage[];
  skipped: {
    url: string;
    reason: string;
  }[];
}

const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_PAGE_TEXT = 20_000;
const USER_AGENT = "TraoInterviewPrepBot";

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return (
      ip.startsWith("10.") ||
      ip.startsWith("127.") ||
      ip.startsWith("192.168.") ||
      ip.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    );
  }

  if (net.isIPv6(ip)) {
    return (
      ip === "::1" ||
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      ip.startsWith("fe80:")
    );
  }

  return false;
}

interface CrawlOptions {
  allowPrivateUrls?: boolean;
}

async function validateUrl(
  rawUrl: string,
  options: CrawlOptions = {}
): Promise<URL> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid company URL: ${rawUrl}`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }

  const allowPrivateUrls =
    options.allowPrivateUrls === true ||
    process.env.ALLOW_PRIVATE_URLS === "true";

  if (!allowPrivateUrls) {
    if (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1"
    ) {
      throw new Error("Private or loopback URLs are not allowed");
    }

    try {
      const addresses = await dns.lookup(url.hostname, {
        all: true,
      });

      if (addresses.some((address) => isPrivateIp(address.address))) {
        throw new Error("Private or loopback URLs are not allowed");
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Private or loopback")
      ) {
        throw error;
      }

      throw new Error(`Could not resolve hostname: ${url.hostname}`);
    }
  }

  return url;
}

async function loadRobots(baseUrl: URL) {
  const robotsUrl = new URL(
    "/robots.txt",
    baseUrl.origin
  );

  try {
    const response =
      await withHttpRetry(() =>
        axios.get<string>(
          robotsUrl.toString(),
          {
            timeout: 5_000,

            headers: {
              "User-Agent":
                USER_AGENT,
              Accept:
                "text/plain",
            },

            validateStatus: () =>
              true,
          }
        )
      );

    /*
     * No robots.txt = no restrictions
     */
    if (response.status === 404) {
      return null;
    }

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      console.warn(
        `robots.txt unavailable (${response.status})`
      );

      return null;
    }

    return robotsParser(
      robotsUrl.toString(),
      response.data
    );
  } catch (error) {
    console.warn(
      "Could not retrieve robots.txt:",
      error instanceof Error
        ? error.message
        : error
    );

    return null;
  }
}

function cleanPageText(html: string): {
  title: string;
  text: string;
} {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();

  $(
    "script, style, noscript, svg, iframe, canvas, template"
  ).remove();

  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PAGE_TEXT);

  return {
    title,
    text,
  };
}

function scoreLink(url: URL, anchorText: string): number {
  const value = `${anchorText} ${url.pathname}`.toLowerCase();

  const weights: Array<[string, number]> = [
    ["hiring", 14],
    ["interview", 13],
    ["careers", 12],
    ["career", 12],
    ["jobs", 11],
    ["job", 9],
    ["handbook", 9],
    ["engineering", 8],
    ["culture", 7],
    ["about", 6],
    ["team", 5],
    ["people", 4],
    ["blog", 3],
  ];

  let score = 0;

  for (const [keyword, weight] of weights) {
    if (value.includes(keyword)) {
      score += weight;
    }
  }

  const negativeKeywords = [
    "privacy",
    "terms",
    "cookie",
    "legal",
    "login",
    "signup",
    "contact",
    "press",
  ];

  for (const keyword of negativeKeywords) {
    if (value.includes(keyword)) {
      score -= 5;
    }
  }

  return score;
}

function extractInternalLinks(
  html: string,
  baseUrl: URL
): Array<{
  url: string;
  text: string;
  score: number;
}> {
  const $ = cheerio.load(html);

  const found = new Map<
    string,
    {
      url: string;
      text: string;
      score: number;
    }
  >();

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");

    if (!href) {
      return;
    }

    try {
      const resolved = new URL(href, baseUrl);

      // Same company only
      if (resolved.origin !== baseUrl.origin) {
        return;
      }

      if (!["http:", "https:"].includes(resolved.protocol)) {
        return;
      }

      // Ignore page fragments
      resolved.hash = "";

      const normalized = resolved.toString();

      const text = $(element)
        .text()
        .replace(/\s+/g, " ")
        .trim();

      const score = scoreLink(resolved, text);

      const existing = found.get(normalized);

      if (!existing || score > existing.score) {
        found.set(normalized, {
          url: normalized,
          text,
          score,
        });
      }
    } catch {
      // Ignore malformed links
    }
  });

  return [...found.values()]
    .filter((link) => link.url !== baseUrl.toString())
    .sort((a, b) => b.score - a.score);
}

async function fetchPage(
  url: string,
  score = 0
): Promise<CrawledPage> {
  const response =
    await withHttpRetry(() =>
      axios.get<string>(url, {
        timeout: 10_000,
        responseType: "text",
        maxContentLength: MAX_PAGE_BYTES,
        maxBodyLength: MAX_PAGE_BYTES,
        maxRedirects: 5,

        headers: {
          "User-Agent":
            "TraoInterviewPrepBot/1.0 (+interview-preparation-assessment)",
          Accept: "text/html,application/xhtml+xml",
        },

        validateStatus: (status) =>
          status >= 200 &&
          status < 400,
      })
    );

  const contentType =
    String(response.headers["content-type"] || "").toLowerCase();

  if (!contentType.includes("text/html")) {
    throw new Error(
      `Unsupported content type: ${contentType || "unknown"}`
    );
  }

  const cleaned = cleanPageText(response.data);

  return {
    url,
    title: cleaned.title,
    text: cleaned.text,
    score,
  };
}

export async function crawlCompany(
  companyUrl: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const validatedUrl = await validateUrl(companyUrl, options);

  const robots =
    await loadRobots(
      validatedUrl
    );

  if (
    robots?.isAllowed(
      validatedUrl.toString(),
      USER_AGENT
    ) === false
  ) {
    throw new Error(
      "Company homepage is blocked by robots.txt"
    );
  }

  const homepageResponse =
    await withHttpRetry(() =>
      axios.get<string>(
        validatedUrl.toString(),
        {
          timeout: 10_000,
          responseType: "text",
          maxContentLength: MAX_PAGE_BYTES,
          maxBodyLength: MAX_PAGE_BYTES,
          maxRedirects: 5,

          headers: {
            "User-Agent":
              "TraoInterviewPrepBot/1.0 (+interview-preparation-assessment)",
            Accept: "text/html,application/xhtml+xml",
          },
        }
      )
    );

  const contentType =
    String(
      homepageResponse.headers["content-type"] || ""
    ).toLowerCase();

  if (!contentType.includes("text/html")) {
    throw new Error(
      `Homepage returned unsupported content type: ${
        contentType || "unknown"
      }`
    );
  }

  const cleanedHomepage = cleanPageText(
    homepageResponse.data
  );

  const homepage: CrawledPage = {
    url: validatedUrl.toString(),
    title: cleanedHomepage.title,
    text: cleanedHomepage.text,
    score: 100,
  };

  const discoveredLinks = extractInternalLinks(
    homepageResponse.data,
    validatedUrl
  );

  console.log("\nTop discovered links:");

  discoveredLinks.slice(0, 10).forEach((link) => {
    console.log(
      `${String(link.score).padStart(2)} | ${link.text || "(no text)"} | ${
        link.url
      }`
    );
  });

  // Fetch only the best links.
  // Keeps crawling fast and cheap.
  const selectedLinks = discoveredLinks
    .filter((link) => link.score > 0)
    .slice(0, 5);

  const pages: CrawledPage[] = [];
  const skipped: CrawlResult["skipped"] = [];

  for (const link of selectedLinks) {
    if (
      robots?.isAllowed(
        link.url,
        USER_AGENT
      ) === false
    ) {
      skipped.push({
        url: link.url,
        reason:
          "Blocked by robots.txt",
      });

      continue;
    }

    try {
      const page = await fetchPage(
        link.url,
        link.score
      );

      pages.push(page);
    } catch (error) {
      skipped.push({
        url: link.url,
        reason:
          error instanceof Error
            ? error.message
            : "Unknown retrieval error",
      });
    }
  }

  return {
    homepage,
    pages,
    skipped,
  };
}