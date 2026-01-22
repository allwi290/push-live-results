/**
 * Client for LiveResults API
 */

import * as logger from "firebase-functions/logger";
import {ApiResponse, Competition, RaceClass, ResultEntry, LastPassing} from "./types";
import JSON5 from "json5";

const LIVE_RESULTS_API = "http://liveresultat.orientering.se/api.php";

/**
 * Fetch competitions from LiveResults API
 */
export async function fetchCompetitions(): Promise<ApiResponse<Competition[]>> {
  const url = new URL(LIVE_RESULTS_API);
  url.searchParams.set("method", "getcompetitions");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Replace control characters at the byte level BEFORE decoding
    for (let i = 0; i < uint8Array.length; i++) {
      const byte = uint8Array[i];
      // Check for control characters: 0x00-0x1F (except HT=0x09, LF=0x0A, CR=0x0D)
      if (byte < 0x20 && byte !== 0x09 && byte !== 0x0A && byte !== 0x0D) {
        uint8Array[i] = 0x20;
      }
    }
    
    const text = new TextDecoder("utf-8", {fatal: false}).decode(uint8Array);
    logger.info(`Decoded: ${text.length} chars`);
    
    // Use JSON5 for more lenient parsing
    const data = JSON5.parse(text);
    return {
      status: "OK",
      data: data.competitions || [],
    };
  } catch (error) {
    logger.error("Error fetching competitions:", error);
    return {
      status: "ERROR",
      data: [],
    };
  }
}

/**
 * Fetch classes for a competition
 */
export async function fetchClasses(
  compId: number,
  lastHash?: string
): Promise<ApiResponse<RaceClass[]>> {
  const url = new URL(LIVE_RESULTS_API);
  url.searchParams.set("method", "getclasses");
  url.searchParams.set("comp", compId.toString());
  if (lastHash) {
    url.searchParams.set("last_hash", lastHash);
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < uint8Array.length; i++) {
      const byte = uint8Array[i];
      if (byte < 0x20 && byte !== 0x09 && byte !== 0x0A && byte !== 0x0D) {
        uint8Array[i] = 0x20;
      }
    }
    
    const text = new TextDecoder("utf-8", {fatal: false}).decode(uint8Array);
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
      data: data.classes || [],
    };
  } catch (error) {
    logger.error("Error fetching classes:", error);
    return {
      status: "ERROR",
      data: [],
    };
  }
}

/**
 * Fetch results for a specific class
 */
export async function fetchClassResults(
  compId: number,
  className: string,
  lastHash?: string
): Promise<ApiResponse<ResultEntry[]>> {
  const url = new URL(LIVE_RESULTS_API);
  url.searchParams.set("method", "getclassresults");
  url.searchParams.set("comp", compId.toString());
  url.searchParams.set("class", className);
  url.searchParams.set("unformattedTimes", "true");
  if (lastHash) {
    url.searchParams.set("last_hash", lastHash);
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < uint8Array.length; i++) {
      const byte = uint8Array[i];
      if (byte < 0x20 && byte !== 0x09 && byte !== 0x0A && byte !== 0x0D) {
        uint8Array[i] = 0x20;
      }
    }
    
    const text = new TextDecoder("utf-8", {fatal: false}).decode(uint8Array);
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
      data: data.results || [],
    };
  } catch (error) {
    logger.error("Error fetching class results:", error);
    return {
      status: "ERROR",
      data: [],
    };
  }
}

/**
 * Fetch last passings for a competition
 */
export async function fetchLastPassings(
  compId: number,
  lastHash?: string
): Promise<ApiResponse<LastPassing[]>> {
  const url = new URL(LIVE_RESULTS_API);
  url.searchParams.set("method", "getlastpassings");
  url.searchParams.set("comp", compId.toString());
  url.searchParams.set("unformattedTimes", "true");
  if (lastHash) {
    url.searchParams.set("last_hash", lastHash);
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < uint8Array.length; i++) {
      const byte = uint8Array[i];
      if (byte < 0x20 && byte !== 0x09 && byte !== 0x0A && byte !== 0x0D) {
        uint8Array[i] = 0x20;
      }
    }
    
    const text = new TextDecoder("utf-8", {fatal: false}).decode(uint8Array);
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
      data: data.passings || [],
    };
  } catch (error) {
    logger.error("Error fetching last passings:", error);
    return {
      status: "ERROR",
      data: [],
    };
  }
}
