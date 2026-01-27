/**
 * Firebase Cloud Functions for Push Live Results
 */

import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
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
            logger.info("Cache HIT (NOT MODIFIED) for getcompetitions");
            res.json({status: "NOT MODIFIED", hash: cached.hash});
            return;
          }

          if (cached) {
            logger.info("Cache HIT for getcompetitions");
            res.json({
              status: "OK",
              hash: cached.hash,
              data: cached.data,
            });
            return;
          }

          logger.info("Cache MISS for getcompetitions - fetching fresh data");
          const compsResult = await fetchCompetitions();
          if (compsResult.status === "OK" && compsResult.data) {
            await setCachedData(cacheKey, Date.now().toString(), compsResult.data);
            logger.info("Cached getcompetitions result: competitions=" + compsResult.data.length);
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
            logger.info("Cache HIT (NOT MODIFIED) for getclasses: comp=" + compId);
            res.json({status: "NOT MODIFIED", hash: cached.hash});
            return;
          }

          if (cached) {
            logger.info("Cache HIT for getclasses: comp=" + compId);
            res.json({
              status: "OK",
              hash: cached.hash,
              data: cached.data,
            });
            return;
          }

          logger.info("Cache MISS for getclasses: comp=" + compId + " - fetching fresh data");
          const classesResult = await fetchClasses(compId, lastHash);
          if (classesResult.status === "OK" && classesResult.data && classesResult.hash) {
            await setCachedData(cacheKey, classesResult.hash, classesResult.data);
            logger.info("Cached getclasses result: comp=" + compId + ", classes=" + classesResult.data.length);
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
            logger.info("Cache HIT (NOT MODIFIED) for getclassresults: comp=" + compId + ", class=" + className);
            res.json({status: "NOT MODIFIED", hash: cached.hash});
            return;
          }

          if (cached) {
            logger.info("Cache HIT for getclassresults: comp=" + compId + ", class=" + className);
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
            } else if (!cached) {
              logger.info("Cache MISS for getclassresults: comp=" + compId + ", class=" + className + " - fetching fresh data");
            }

            await setCachedData(cacheKey, resultsResult.hash, resultsResult.data);
            logger.info("Cached getclassresults result: comp=" + compId + ", class=" + className + ", results=" + resultsResult.data.length);
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
            logger.info("Cache HIT (NOT MODIFIED) for getlastpassings: comp=" + compId);
            res.json({status: "NOT MODIFIED", hash: cached.hash});
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

          logger.info("Cache MISS for getlastpassings: comp=" + compId + " - fetching fresh data");
          const passingsResult = await fetchLastPassings(compId, lastHash);
          if (passingsResult.status === "OK" && passingsResult.data && passingsResult.hash) {
            await setCachedData(cacheKey, passingsResult.hash, passingsResult.data);
            logger.info("Cached getlastpassings result: comp=" + compId + ", passings=" + passingsResult.data.length);
            res.json(passingsResult);
          } else if (passingsResult.status === "NOT MODIFIED") {
            res.json(passingsResult);
          } else {
            res.status(500).json({error: "Failed to fetch last passings"});
          }
          break;
        }

        case "getclubs": {
          if (!compId) {
            res.status(400).json({error: "Missing 'comp' parameter"});
            return;
          }

          const cacheKey = getCacheKey({method, comp: compId});
          const cached = await getCachedData(cacheKey, CACHE_TTL.CLUBS);

          if (cached) {
            logger.info("Cache HIT for getclubs: comp=" + compId);
            res.json({
              status: "OK",
              hash: cached.hash,
              data: cached.data,
            });
            return;
          }

          logger.info("Cache MISS for getclubs: comp=" + compId + " - fetching fresh data");

          // Fetch all classes for the competition
          const classesResult = await fetchClasses(compId);
          if (classesResult.status !== "OK" || !classesResult.data) {
            res.status(500).json({error: "Failed to fetch classes"});
            return;
          }

          // Aggregate clubs from all class results
          const clubMap = new Map<string, number>();

          for (const raceClass of classesResult.data) {
            const resultsResult = await fetchClassResults(compId, raceClass.className);
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

          const result = {data: clubs};
          await setCachedData(cacheKey, Date.now().toString(), clubs);
          logger.info("Cached getclubs result: comp=" + compId + ", clubs=" + clubs.length);

          res.json({
            status: "OK",
            hash: Date.now().toString(),
            ...result,
          });
          break;
        }

        case "getrunnersforclub": {
          if (!compId) {
            res.status(400).json({error: "Missing 'comp' parameter"});
            return;
          }

          const clubName = req.query.club as string;
          if (!clubName) {
            res.status(400).json({error: "Missing 'club' parameter"});
            return;
          }

          const cacheKey = getCacheKey({method, comp: compId, club: clubName});
          const cached = await getCachedData(cacheKey, CACHE_TTL.CLUB_RUNNERS);

          if (cached) {
            logger.info("Cache HIT for getrunnersforclub: comp=" + compId + ", club=" + clubName);
            res.json({
              status: "OK",
              hash: cached.hash,
              data: cached.data,
            });
            return;
          }

          logger.info("Cache MISS for getrunnersforclub: comp=" + compId + ", club=" + clubName + " - fetching fresh data");

          // Fetch all classes for the competition
          const classesResult = await fetchClasses(compId);
          if (classesResult.status !== "OK" || !classesResult.data) {
            res.status(500).json({error: "Failed to fetch classes"});
            return;
          }

          // Aggregate runners from the specified club across all classes
          const clubRunners: ResultEntry[] = [];

          for (const raceClass of classesResult.data) {
            const resultsResult = await fetchClassResults(compId, raceClass.className);
            if (resultsResult.status === "OK" && resultsResult.data) {
              const classRunners = resultsResult.data.filter(
                (entry) => entry.club === clubName
              );
              // Add class information to each runner
              clubRunners.push(
                ...classRunners.map((runner) => ({
                  ...runner,
                  className: raceClass.className,
                }))
              );
            }
          }

          await setCachedData(cacheKey, Date.now().toString(), clubRunners);
          logger.info("Cached getrunnersforclub result: comp=" + compId + ", club=" + clubName + ", runners=" + clubRunners.length);

          res.json({
            status: "OK",
            hash: Date.now().toString(),
            data: clubRunners,
          });
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

/**
 * Scheduled function to poll active selections and send notifications
 * Runs every minute to check for updates in followed competitions
 */
export const pollActiveSelections = onSchedule(
  {schedule: "* * * * *", maxInstances: 1},
  async () => {
    logger.info("Starting active selections polling");

    try {
      const db = getFirestore();
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

      // Get all active selections (created within last 24 hours)
      const snapshot = await db
        .collection("selections")
        .where("createdAt", ">", twentyFourHoursAgo)
        .get();

      if (snapshot.empty) {
        logger.info("No active selections to poll");
        return;
      }

      // Group selections by competition/class to deduplicate API calls
      const uniqueTargets = new Map<string, {compId: string; className: string}>();

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

      logger.info(`Polling ${uniqueTargets.size} unique competition/class combinations for ${snapshot.size} active selections`);

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
          const oldResults = cached?.data as ResultEntry[] || [];

          // Fetch fresh data from LiveResults API
          const resultsResult = await fetchClassResults(
            parseInt(target.compId),
            target.className
          );

          if (resultsResult.status === "NOT MODIFIED") {
            logger.info(`No changes for ${key}`);
            continue;
          }

          if (resultsResult.status !== "OK" || !resultsResult.data) {
            logger.warn(`Failed to fetch results for ${key}`);
            continue;
          }

          const newResults = resultsResult.data;

          // Check if results actually changed (comparing with cached data)
          if (oldResults.length > 0) {
            logger.info(`Detected changes for ${key} - triggering notifications`);
            await notifyResultChanges(
              target.compId,
              target.className,
              oldResults,
              newResults
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
  }
);
