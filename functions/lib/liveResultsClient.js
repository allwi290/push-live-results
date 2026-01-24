"use strict";
/**
 * Client for LiveResults API
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCompetitions = fetchCompetitions;
exports.fetchClasses = fetchClasses;
exports.fetchClassResults = fetchClassResults;
exports.fetchLastPassings = fetchLastPassings;
const logger = __importStar(require("firebase-functions/logger"));
const json5_1 = __importDefault(require("json5"));
const LIVE_RESULTS_API = "https://liveresultat.orientering.se/api.php";
/**
 * Sanitize byte array by replacing control characters
 */
function sanitizeControlCharacters(uint8Array) {
    for (let i = 0; i < uint8Array.length; i++) {
        const byte = uint8Array[i];
        // Check for control characters: 0x00-0x1F (except HT=0x09, LF=0x0A, CR=0x0D)
        if (byte < 0x20 && byte !== 0x09 && byte !== 0x0A && byte !== 0x0D) {
            uint8Array[i] = 0x20;
        }
    }
}
/**
 * Generic fetch function for LiveResults API
 */
async function fetchFromAPI(params, dataKey) {
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
        const data = json5_1.default.parse(text);
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
    }
    catch (error) {
        logger.error(`Error fetching from API (${params.method}):`, error);
        return {
            status: "ERROR",
            data: [],
        };
    }
}
/**
 * Fetch competitions from LiveResults API
 */
async function fetchCompetitions() {
    const response = await fetchFromAPI({ method: "getcompetitions" }, "competitions");
    if (response.status === "OK" && response.data) {
        // Filter and sort competitions:
        // - Only include events from the last 7 days
        // - Exclude future events
        // - Sort with latest first (descending)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const filtered = response.data
            .filter((comp) => {
            const compDate = new Date(comp.date);
            return compDate <= now && compDate >= sevenDaysAgo;
        })
            .sort((a, b) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        logger.info(`Filtered competitions: ${filtered.length} out of ${response.data.length}`);
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
async function fetchClasses(compId, lastHash) {
    const params = {
        method: "getclasses",
        comp: compId.toString(),
    };
    if (lastHash) {
        params.last_hash = lastHash;
    }
    return fetchFromAPI(params, "classes");
}
/**
 * Fetch results for a specific class
 */
async function fetchClassResults(compId, className, lastHash) {
    const params = {
        method: "getclassresults",
        comp: compId.toString(),
        class: className,
        unformattedTimes: "false",
    };
    if (lastHash) {
        params.last_hash = lastHash;
    }
    return fetchFromAPI(params, "results");
}
/**
 * Fetch last passings for a competition
 */
async function fetchLastPassings(compId, lastHash) {
    const params = {
        method: "getlastpassings",
        comp: compId.toString(),
        unformattedTimes: "false",
    };
    if (lastHash) {
        params.last_hash = lastHash;
    }
    return fetchFromAPI(params, "passings");
}
//# sourceMappingURL=liveResultsClient.js.map