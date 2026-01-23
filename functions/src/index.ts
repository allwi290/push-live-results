/**
 * Firebase Cloud Functions for Push Live Results
 */

import {initializeApp} from "firebase-admin/app";
import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import {
  fetchCompetitions,
  fetchClasses,
  fetchClassResults,
  fetchLastPassings,
} from "./liveResultsClient";
import {
  getCachedData,
  setCachedData,
  getCacheKey,
  cleanOldCache,
  CACHE_TTL,
} from "./cache";
import {notifyResultChanges, cleanOldSelections} from "./notifications";
import type {ResultEntry} from "./types";

// Initialize Firebase Admin
initializeApp();

// Set global options for cost control
setGlobalOptions({maxInstances: 10});

/**
 * API proxy endpoint for LiveResults
 * GET /api?method=<method>&comp=<compId>&class=<className>&last_hash=<hash>
 */
export const api = onRequest(
  {cors: true, maxInstances: 5},
  async (req, res) => {
    try {
      const method = req.query.method as string;
      const compId = req.query.comp ? parseInt(req.query.comp as string) : null;
      const className = req.query.class as string;
      const lastHash = req.query.last_hash as string;

      if (!method) {
        res.status(400).json({error: "Missing 'method' parameter"});
        return;
      }

      logger.info(`API request: method=${method}, comp=${compId}, class=${className}`);

      switch (method) {
        case "getcompetitions": {
          // Competitions list changes rarely, cache for 1 hour
          const cacheKey = getCacheKey({method});
          const cached = await getCachedData(cacheKey, CACHE_TTL.COMPETITIONS);

          if (cached && lastHash && cached.hash === lastHash) {
            res.json({status: "NOT MODIFIED", hash: cached.hash});
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

          const compsResult = await fetchCompetitions();
          if (compsResult.status === "OK" && compsResult.data) {
            await setCachedData(cacheKey, Date.now().toString(), compsResult.data);
            res.json({
              status: "OK",
              hash: Date.now().toString(),
              data: compsResult.data,
            });
          } else {
            res.status(500).json({error: "Failed to fetch competitions"});
          }
          break;
        }

        case "getclasses": {
          if (!compId) {
            res.status(400).json({error: "Missing 'comp' parameter"});
            return;
          }

          const cacheKey = getCacheKey({method, comp: compId});
          const cached = await getCachedData(cacheKey, CACHE_TTL.CLASSES);

          if (cached && lastHash && cached.hash === lastHash) {
            res.json({status: "NOT MODIFIED", hash: cached.hash});
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

          const classesResult = await fetchClasses(compId, lastHash);
          if (classesResult.status === "OK" && classesResult.data && classesResult.hash) {
            await setCachedData(cacheKey, classesResult.hash, classesResult.data);
            res.json(classesResult);
          } else if (classesResult.status === "NOT MODIFIED") {
            res.json(classesResult);
          } else {
            res.status(500).json({error: "Failed to fetch classes"});
          }
          break;
        }

        case "getclassresults": {
          if (!compId || !className) {
            res.status(400).json({error: "Missing 'comp' or 'class' parameter"});
            return;
          }

          const cacheKey = getCacheKey({method, comp: compId, class: className});
          const cached = await getCachedData(cacheKey, CACHE_TTL.CLASS_RESULTS);

          if (cached && lastHash && cached.hash === lastHash) {
            res.json({status: "NOT MODIFIED", hash: cached.hash});
            return;
          }

          const resultsResult = await fetchClassResults(compId, className, lastHash);

          if (resultsResult.status === "OK" && resultsResult.data && resultsResult.hash) {
            // Check for changes and send notifications
            if (cached && cached.data && Array.isArray(cached.data)) {
              await notifyResultChanges(
                compId.toString(),
                className,
                cached.data as ResultEntry[],
                resultsResult.data
              );
            }

            await setCachedData(cacheKey, resultsResult.hash, resultsResult.data);
            res.json(resultsResult);
          } else if (resultsResult.status === "NOT MODIFIED") {
            if (cached) {
              res.json({
                status: "OK",
                hash: cached.hash,
                data: cached.data,
              });
            } else {
              res.json(resultsResult);
            }
          } else {
            res.status(500).json({error: "Failed to fetch class results"});
          }
          break;
        }

        case "getlastpassings": {
          if (!compId) {
            res.status(400).json({error: "Missing 'comp' parameter"});
            return;
          }

          const cacheKey = getCacheKey({method, comp: compId});
          const cached = await getCachedData(cacheKey, CACHE_TTL.LAST_PASSINGS);

          if (cached && lastHash && cached.hash === lastHash) {
            res.json({status: "NOT MODIFIED", hash: cached.hash});
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

          const passingsResult = await fetchLastPassings(compId, lastHash);
          if (passingsResult.status === "OK" && passingsResult.data && passingsResult.hash) {
            await setCachedData(cacheKey, passingsResult.hash, passingsResult.data);
            res.json(passingsResult);
          } else if (passingsResult.status === "NOT MODIFIED") {
            res.json(passingsResult);
          } else {
            res.status(500).json({error: "Failed to fetch last passings"});
          }
          break;
        }

        default:
          res.status(400).json({error: `Unsupported method: ${method}`});
      }
    } catch (error) {
      logger.error("Error in API handler:", error);
      res.status(500).json({error: "Internal server error"});
    }
  }
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
