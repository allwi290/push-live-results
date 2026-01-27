/**
 * Client for LiveResults API
 */

import * as logger from "firebase-functions/logger";
import {
  ApiResponse,
  Competition,
  RaceClass,
  ResultEntry,
  LastPassing,
} from "./types";
import JSON5 from "json5";

const LIVE_RESULTS_API = "https://liveresultat.orientering.se/api.php";

/**
 * Sanitize byte array by replacing control characters
 */
function sanitizeControlCharacters(uint8Array: Uint8Array): void {
  for (let i = 0; i < uint8Array.length; i++) {
    const byte = uint8Array[i];
    // Check for control characters: 0x00-0x1F (except HT=0x09, LF=0x0A, CR=0x0D)
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) {
      uint8Array[i] = 0x20;
    }
  }
}

/**
 * Generic fetch function for LiveResults API
 */
async function fetchFromAPI<T>(
  params: Record<string, string>,
  dataKey: string,
): Promise<ApiResponse<T>> {
  const url = new URL(LIVE_RESULTS_API);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    sanitizeControlCharacters(uint8Array);

    const text = new TextDecoder("utf-8", { fatal: false }).decode(uint8Array);
    const data = JSON5.parse(text);

    if (data.status === "NOT MODIFIED") {
      return {
        status: "NOT MODIFIED",
        hash: data.hash,
      };
    }

    return {
      status: "OK",
      hash: data.hash,
      data: data[dataKey] || [],
    };
  } catch (error) {
    logger.error(`Error fetching from API (${params.method}):`, error);
    return {
      status: "ERROR",
      data: [] as T,
    };
  }
}

/**
 * Fetch competitions from LiveResults API
 */
export async function fetchCompetitions(): Promise<ApiResponse<Competition[]>> {
  const response = await fetchFromAPI<Competition[]>(
    { method: "getcompetitions", lang: "en" },
    "competitions",
  );

  if (response.status === "OK" && response.data) {
    // Filter and sort competitions:
    // - Only include events from the last 7 days
    // - Exclude future events
    // - Sort with latest first (descending)
    const now = new Date();
    const toDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    const fromDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const filtered = response.data
      .filter((comp: Competition) => {
        const compDate = new Date(comp.date);
        return compDate <= toDate && compDate >= fromDate;
      })
      .sort((a: Competition, b: Competition) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

    logger.info(
      `Filtered competitions: ${filtered.length} out of ${response.data.length}`,
    );

    return {
      status: "OK",
      data: filtered,
    };
  }

  return response;
}

/**
 * Fetch classes for a competition
 */
export async function fetchClasses(
  compId: number,
  lastHash?: string,
): Promise<ApiResponse<RaceClass[]>> {
  const params: Record<string, string> = {
    method: "getclasses",
    comp: compId.toString(),
    lang: "en",
  };
  if (lastHash) {
    params.last_hash = lastHash;
  }

  return fetchFromAPI<RaceClass[]>(params, "classes");
}

/**
 * Fetch results for a specific class
 */
export async function fetchClassResults(
  compId: number,
  className: string,
  lastHash?: string,
): Promise<ApiResponse<ResultEntry[]>> {
  const params: Record<string, string> = {
    method: "getclassresults",
    comp: compId.toString(),
    class: className,
    unformattedTimes: "false",
    lang: "en",
  };
  if (lastHash) {
    params.last_hash = lastHash;
  }

  return fetchFromAPI<ResultEntry[]>(params, "results");
}

/**
 * Fetch last passings for a competition
 */
export async function fetchLastPassings(
  compId: number,
  lastHash?: string,
): Promise<ApiResponse<LastPassing[]>> {
  const params: Record<string, string> = {
    method: "getlastpassings",
    comp: compId.toString(),
    unformattedTimes: "false",
    lang: "en",
  };
  if (lastHash) {
    params.last_hash = lastHash;
  }

  return fetchFromAPI<LastPassing[]>(params, "passings");
}
