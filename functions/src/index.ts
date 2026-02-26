/**
 * Firebase Cloud Functions for Push Live Results
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { fetchClassResultsFull, fetchLastPassings } from "./liveResultsClient";
import {
  getCachedData,
  setCachedData,
  getCacheKey,
  cleanOldCache,
  CACHE_TTL,
} from "./cache";
import { notifyResultChanges, cleanOldSelections } from "./notifications";
import type { ResultEntry } from "./types";

// Initialize Firebase Admin
initializeApp();

// Set global options for cost control
setGlobalOptions({ maxInstances: 10 });

/**
 * API proxy endpoint for LiveResults
 * GET /api?method=<method>&comp=<compId>&class=<className>&last_hash=<hash>
 */
export const api = onRequest(
  { cors: true, maxInstances: 5 },
  async (req, res) => {
    try {
      const method = req.query.method as string;
      const compId = req.query.comp ? parseInt(req.query.comp as string) : null;
      const className = req.query.class as string;
      const lastHash = req.query.last_hash as string;

      if (!method) {
        res.status(400).json({ error: "Missing 'method' parameter" });
        return;
      }

      logger.info(
        `API request: method=${method}, comp=${compId}, class=${className}`,
      );

      switch (method) {
        case "getlastpassings": {
          if (!compId) {
            res.status(400).json({ error: "Missing 'comp' parameter" });
            return;
          }

          const cacheKey = getCacheKey({ method, comp: compId });
          const cached = await getCachedData(cacheKey, CACHE_TTL.LAST_PASSINGS);

          if (cached && lastHash && cached.hash === lastHash) {
            logger.info(
              "Cache HIT (NOT MODIFIED) for getlastpassings: comp=" + compId,
            );
            res.json({ status: "NOT MODIFIED", hash: cached.hash });
            return;
          }

          if (cached) {
            logger.info("Cache HIT for getlastpassings: comp=" + compId);
            res.json({
              status: "OK",
              hash: cached.hash,
              data: cached.data,
            });
            return;
          }

          logger.info(
            "Cache MISS for getlastpassings: comp=" +
              compId +
              " - fetching fresh data",
          );
          const passingsResult = await fetchLastPassings(compId, lastHash);
          if (
            passingsResult.status === "OK" &&
            passingsResult.data &&
            passingsResult.hash
          ) {
            await setCachedData(
              cacheKey,
              passingsResult.hash,
              passingsResult.data,
            );
            logger.info(
              "Cached getlastpassings result: comp=" +
                compId +
                ", passings=" +
                passingsResult.data.length,
            );
            res.json(passingsResult);
          } else if (passingsResult.status === "NOT MODIFIED") {
            res.json(passingsResult);
          } else {
            res.status(500).json({ error: "Failed to fetch last passings" });
          }
          break;
        }

        default:
          res.status(400).json({ error: `Unsupported method: ${method}` });
      }
    } catch (error) {
      logger.error("Error in API handler:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * Scheduled function to clean up old cache entries
 * Runs daily at 2 AM UTC
 */
export const cleanCache = onSchedule("0 2 * * *", async () => {
  logger.info("Starting cache cleanup");
  await cleanOldCache();
  logger.info("Cache cleanup completed");
});

/**
 * Scheduled function to clean up old user selections
 * Runs daily at 3 AM UTC
 */
export const cleanSelections = onSchedule("0 3 * * *", async () => {
  logger.info("Starting selections cleanup");
  await cleanOldSelections();
  logger.info("Selections cleanup completed");
});

/**
 * Scheduled function to poll active selections and send notifications
 * Runs every minute to check for updates in followed competitions
 */
export const pollActiveSelections = onSchedule(
  { schedule: "* * * * *", maxInstances: 1 },
  async () => {
    logger.info("Starting active selections polling");

    try {
      // At each poll, look for selections whose startTime is within a sliding window
      // from 180 minutes before "now" to 30 minutes after "now".
      //
      // For a runner with startTime S, this means their selection will match the query
      // on every poll where "now" is between S - 30 minutes and S + 180 minutes:
      //   S - 30 min <= now <= S + 180 min  ⇔  now - 180 min <= S <= now + 30 min
      //
      // In other words, we effectively follow each runner from 30 minutes before their
      // scheduled start time until 180 minutes after, while the code always queries
      // in terms of a window around the current server time.
      const db = getFirestore();
      const now = new Date();
      const windowStart = now.getTime() - 180 * 60 * 1000; // 180 minutes ago (timestamp in ms)
      const windowEnd = now.getTime() + 30 * 60 * 1000; // 30 minutes from now (timestamp in ms)

      // Get selections where startTime is within the window (numeric timestamp)
      const query = db
        .collection("selections")
        .where("startTime", ">=", windowStart)
        .where("startTime", "<=", windowEnd);
      const snapshot = await query.get();

      if (snapshot.empty) {
        logger.info(
          `No active selections within start time window ${new Date(windowStart).toISOString().split("T")[1]} - ${new Date(windowEnd).toISOString().split("T")[1]}`,
        );
        return;
      }

      // Group selections by competition/class to deduplicate API calls
      const uniqueTargets = new Map<
        string,
        { compId: string; className: string }
      >();

      snapshot.docs.forEach((doc) => {
        const selection = doc.data();
        const key = `${selection.competitionId}_${selection.className}`;
        if (!uniqueTargets.has(key)) {
          uniqueTargets.set(key, {
            compId: selection.competitionId,
            className: selection.className,
          });
        }
      });

      logger.info(
        `Polling ${uniqueTargets.size} unique competition/class combinations for ${snapshot.size} active selections`,
      );

      // Poll each unique competition/class
      for (const [key, target] of uniqueTargets) {
        try {
          const cacheKey = getCacheKey({
            method: "getclassresult",
            comp: target.compId,
            class: target.className,
          });

          // Get cached data to compare
          const cached = await getCachedData(cacheKey, CACHE_TTL.CLASS_RESULTS);
          const oldResults = (cached?.data as ResultEntry[]) || [];
          const cachedHash = cached?.hash;

          // Fetch fresh data from LiveResults API (with splitcontrols)
          const resultsResult = await fetchClassResultsFull(
            parseInt(target.compId),
            target.className,
            cachedHash,
          );

          if (resultsResult.status === "NOT MODIFIED") {
            logger.info(`No changes for ${key}`);
            continue;
          }

          if (resultsResult.status !== "OK" || !resultsResult.results) {
            logger.warn(`Failed to fetch results for ${key}`);
            continue;
          }

          const newResults = resultsResult.results;

          // Check if results actually changed (comparing with cached data)
          if (oldResults.length > 0) {
            logger.info(
              `Detected changes for ${key} - triggering notifications`,
            );
            await notifyResultChanges(
              target.compId,
              target.className,
              oldResults,
              newResults,
              resultsResult.splitcontrols,
            );
          } else {
            logger.info(`First poll for ${key} - establishing baseline`);
          }

          // Update cache with new data
          if (resultsResult.hash) {
            await setCachedData(cacheKey, resultsResult.hash, newResults);
          }
        } catch (error) {
          logger.error(`Error polling ${key}:`, error);
        }
      }
      logger.info("Active selections polling completed");
    } catch (error) {
      logger.error("Error in pollActiveSelections:", error);
    }
  },
);
