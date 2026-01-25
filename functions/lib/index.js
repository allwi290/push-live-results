"use strict";
/**
 * Firebase Cloud Functions for Push Live Results
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSelections = exports.cleanCache = exports.api = void 0;
const app_1 = require("firebase-admin/app");
const firebase_functions_1 = require("firebase-functions");
const https_1 = require("firebase-functions/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = __importStar(require("firebase-functions/logger"));
const liveResultsClient_1 = require("./liveResultsClient");
const cache_1 = require("./cache");
const notifications_1 = require("./notifications");
// Initialize Firebase Admin
(0, app_1.initializeApp)();
// Set global options for cost control
(0, firebase_functions_1.setGlobalOptions)({ maxInstances: 10 });
/**
 * API proxy endpoint for LiveResults
 * GET /api?method=<method>&comp=<compId>&class=<className>&last_hash=<hash>
 */
exports.api = (0, https_1.onRequest)({ cors: true, maxInstances: 5 }, async (req, res) => {
    try {
        const method = req.query.method;
        const compId = req.query.comp ? parseInt(req.query.comp) : null;
        const className = req.query.class;
        const lastHash = req.query.last_hash;
        if (!method) {
            res.status(400).json({ error: "Missing 'method' parameter" });
            return;
        }
        logger.info(`API request: method=${method}, comp=${compId}, class=${className}`);
        switch (method) {
            case "getcompetitions": {
                // Competitions list changes rarely, cache for 1 hour
                const cacheKey = (0, cache_1.getCacheKey)({ method });
                const cached = await (0, cache_1.getCachedData)(cacheKey, cache_1.CACHE_TTL.COMPETITIONS);
                if (cached && lastHash && cached.hash === lastHash) {
                    res.json({ status: "NOT MODIFIED", hash: cached.hash });
                    return;
                }
                if (cached) {
                    res.json({
                        status: "OK",
                        hash: cached.hash,
                        data: cached.data,
                    });
                    return;
                }
                const compsResult = await (0, liveResultsClient_1.fetchCompetitions)();
                if (compsResult.status === "OK" && compsResult.data) {
                    await (0, cache_1.setCachedData)(cacheKey, Date.now().toString(), compsResult.data);
                    res.json({
                        status: "OK",
                        hash: Date.now().toString(),
                        data: compsResult.data,
                    });
                }
                else {
                    res.status(500).json({ error: "Failed to fetch competitions" });
                }
                break;
            }
            case "getclasses": {
                if (!compId) {
                    res.status(400).json({ error: "Missing 'comp' parameter" });
                    return;
                }
                const cacheKey = (0, cache_1.getCacheKey)({ method, comp: compId });
                const cached = await (0, cache_1.getCachedData)(cacheKey, cache_1.CACHE_TTL.CLASSES);
                if (cached && lastHash && cached.hash === lastHash) {
                    res.json({ status: "NOT MODIFIED", hash: cached.hash });
                    return;
                }
                if (cached) {
                    res.json({
                        status: "OK",
                        hash: cached.hash,
                        data: cached.data,
                    });
                    return;
                }
                const classesResult = await (0, liveResultsClient_1.fetchClasses)(compId, lastHash);
                if (classesResult.status === "OK" && classesResult.data && classesResult.hash) {
                    await (0, cache_1.setCachedData)(cacheKey, classesResult.hash, classesResult.data);
                    res.json(classesResult);
                }
                else if (classesResult.status === "NOT MODIFIED") {
                    res.json(classesResult);
                }
                else {
                    res.status(500).json({ error: "Failed to fetch classes" });
                }
                break;
            }
            case "getclassresults": {
                if (!compId || !className) {
                    res.status(400).json({ error: "Missing 'comp' or 'class' parameter" });
                    return;
                }
                const cacheKey = (0, cache_1.getCacheKey)({ method, comp: compId, class: className });
                const cached = await (0, cache_1.getCachedData)(cacheKey, cache_1.CACHE_TTL.CLASS_RESULTS);
                if (cached && lastHash && cached.hash === lastHash) {
                    res.json({ status: "NOT MODIFIED", hash: cached.hash });
                    return;
                }
                const resultsResult = await (0, liveResultsClient_1.fetchClassResults)(compId, className, lastHash);
                if (resultsResult.status === "OK" && resultsResult.data && resultsResult.hash) {
                    // Check for changes and send notifications
                    if (cached && cached.data && Array.isArray(cached.data)) {
                        await (0, notifications_1.notifyResultChanges)(compId.toString(), className, cached.data, resultsResult.data);
                    }
                    await (0, cache_1.setCachedData)(cacheKey, resultsResult.hash, resultsResult.data);
                    res.json(resultsResult);
                }
                else if (resultsResult.status === "NOT MODIFIED") {
                    if (cached) {
                        res.json({
                            status: "OK",
                            hash: cached.hash,
                            data: cached.data,
                        });
                    }
                    else {
                        res.json(resultsResult);
                    }
                }
                else {
                    res.status(500).json({ error: "Failed to fetch class results" });
                }
                break;
            }
            case "getlastpassings": {
                if (!compId) {
                    res.status(400).json({ error: "Missing 'comp' parameter" });
                    return;
                }
                const cacheKey = (0, cache_1.getCacheKey)({ method, comp: compId });
                const cached = await (0, cache_1.getCachedData)(cacheKey, cache_1.CACHE_TTL.LAST_PASSINGS);
                if (cached && lastHash && cached.hash === lastHash) {
                    res.json({ status: "NOT MODIFIED", hash: cached.hash });
                    return;
                }
                if (cached) {
                    res.json({
                        status: "OK",
                        hash: cached.hash,
                        data: cached.data,
                    });
                    return;
                }
                const passingsResult = await (0, liveResultsClient_1.fetchLastPassings)(compId, lastHash);
                if (passingsResult.status === "OK" && passingsResult.data && passingsResult.hash) {
                    await (0, cache_1.setCachedData)(cacheKey, passingsResult.hash, passingsResult.data);
                    res.json(passingsResult);
                }
                else if (passingsResult.status === "NOT MODIFIED") {
                    res.json(passingsResult);
                }
                else {
                    res.status(500).json({ error: "Failed to fetch last passings" });
                }
                break;
            }
            case "getclubs": {
                if (!compId) {
                    res.status(400).json({ error: "Missing 'comp' parameter" });
                    return;
                }
                const cacheKey = (0, cache_1.getCacheKey)({ method, comp: compId });
                const cached = await (0, cache_1.getCachedData)(cacheKey, cache_1.CACHE_TTL.CLUBS);
                if (cached) {
                    res.json({
                        status: "OK",
                        hash: cached.hash,
                        data: cached.data,
                    });
                    return;
                }
                // Fetch all classes for the competition
                const classesResult = await (0, liveResultsClient_1.fetchClasses)(compId);
                if (classesResult.status !== "OK" || !classesResult.data) {
                    res.status(500).json({ error: "Failed to fetch classes" });
                    return;
                }
                // Aggregate clubs from all class results
                const clubMap = new Map();
                for (const raceClass of classesResult.data) {
                    const resultsResult = await (0, liveResultsClient_1.fetchClassResults)(compId, raceClass.className);
                    if (resultsResult.status === "OK" && resultsResult.data) {
                        for (const entry of resultsResult.data) {
                            if (entry.club) {
                                const current = clubMap.get(entry.club) || 0;
                                clubMap.set(entry.club, current + 1);
                            }
                        }
                    }
                }
                // Convert map to array and sort by number of runners (descending)
                const clubs = Array.from(clubMap, ([name, runners]) => ({
                    name,
                    runners,
                }))
                    .sort((a, b) => b.runners - a.runners);
                const result = { data: clubs };
                await (0, cache_1.setCachedData)(cacheKey, Date.now().toString(), clubs);
                res.json(Object.assign({ status: "OK", hash: Date.now().toString() }, result));
                break;
            }
            case "getrunnersforclub": {
                if (!compId) {
                    res.status(400).json({ error: "Missing 'comp' parameter" });
                    return;
                }
                const clubName = req.query.club;
                if (!clubName) {
                    res.status(400).json({ error: "Missing 'club' parameter" });
                    return;
                }
                const cacheKey = (0, cache_1.getCacheKey)({ method, comp: compId, club: clubName });
                const cached = await (0, cache_1.getCachedData)(cacheKey, cache_1.CACHE_TTL.CLUB_RUNNERS);
                if (cached) {
                    res.json({
                        status: "OK",
                        hash: cached.hash,
                        data: cached.data,
                    });
                    return;
                }
                // Fetch all classes for the competition
                const classesResult = await (0, liveResultsClient_1.fetchClasses)(compId);
                if (classesResult.status !== "OK" || !classesResult.data) {
                    res.status(500).json({ error: "Failed to fetch classes" });
                    return;
                }
                // Aggregate runners from the specified club across all classes
                const clubRunners = [];
                for (const raceClass of classesResult.data) {
                    const resultsResult = await (0, liveResultsClient_1.fetchClassResults)(compId, raceClass.className);
                    if (resultsResult.status === "OK" && resultsResult.data) {
                        const classRunners = resultsResult.data.filter((entry) => entry.club === clubName);
                        // Add class information to each runner
                        clubRunners.push(...classRunners.map((runner) => (Object.assign(Object.assign({}, runner), { className: raceClass.className }))));
                    }
                }
                await (0, cache_1.setCachedData)(cacheKey, Date.now().toString(), clubRunners);
                res.json({
                    status: "OK",
                    hash: Date.now().toString(),
                    data: clubRunners,
                });
                break;
            }
            default:
                res.status(400).json({ error: `Unsupported method: ${method}` });
        }
    }
    catch (error) {
        logger.error("Error in API handler:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * Scheduled function to clean up old cache entries
 * Runs daily at 2 AM UTC
 */
exports.cleanCache = (0, scheduler_1.onSchedule)("0 2 * * *", async () => {
    logger.info("Starting cache cleanup");
    await (0, cache_1.cleanOldCache)();
    logger.info("Cache cleanup completed");
});
/**
 * Scheduled function to clean up old user selections
 * Runs daily at 3 AM UTC
 */
exports.cleanSelections = (0, scheduler_1.onSchedule)("0 3 * * *", async () => {
    logger.info("Starting selections cleanup");
    await (0, notifications_1.cleanOldSelections)();
    logger.info("Selections cleanup completed");
});
//# sourceMappingURL=index.js.map