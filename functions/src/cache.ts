/**
 * Firestore cache management for LiveResults API responses
 */

import {getFirestore, Timestamp} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {CachedData} from "./types";

const CACHE_COLLECTION = "api_cache";

// Cache TTL constants
export const CACHE_TTL = {
  COMPETITIONS: 6 * 60 * 60 * 1000, // 6 hours
  CLASSES: 15 * 60 * 1000, // 15 minutes
  CLASS_RESULTS: 15 * 60 * 1000, // 15 minutes
  LAST_PASSINGS: 2 * 60 * 1000, // 2 minutes
  CLUBS: 15 * 60 * 1000, // 15 minutes
  CLUB_RUNNERS: 15 * 60 * 1000, // 15 minutes
};

/**
 * Get cached data from Firestore
 */
export async function getCachedData(
  cacheKey: string,
  ttlMs: number
): Promise<CachedData | null> {
  try {
    const db = getFirestore();
    const docRef = db.collection(CACHE_COLLECTION).doc(cacheKey);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as CachedData;
    const now = Date.now();
    const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : data.timestamp;

    // Check if cache is expired
    if (now - timestamp > ttlMs) {
      logger.info(`Cache expired for key: ${cacheKey}`);
      return null;
    }

    logger.info(`Cache hit for key: ${cacheKey}`);
    return data;
  } catch (error) {
    // Log cache read failures at error level
    if (error instanceof Error && error.message.includes("NOT_FOUND")) {
      logger.error("Firestore database not configured - cache reads will be skipped");
    } else if (error instanceof Error) {
      logger.error("Cache read failed: " + error.message);
    } else {
      logger.error("Cache read failed with unknown error");
    }
    return null;
  }
}

/**
 * Save data to Firestore cache
 */
export async function setCachedData(
  cacheKey: string,
  hash: string,
  data: unknown
): Promise<void> {
  try {
    const db = getFirestore();
    const docRef = db.collection(CACHE_COLLECTION).doc(cacheKey);

    const cachedData: CachedData = {
      hash,
      data,
      timestamp: Timestamp.now(),
    };

    await docRef.set(cachedData);
    logger.info(`Cache updated for key: ${cacheKey}`);
  } catch (error) {
    // Log cache write failures at error level
    if (error instanceof Error) {
      if (error.message.includes("NOT_FOUND")) {
        logger.error("Firestore database not configured - cache writes will be skipped");
      } else {
        logger.error("Cache write failed: " + error.message);
      }
    } else {
      logger.error("Cache write failed with unknown error");
    }
  }
}

/**
 * Generate cache key from parameters
 */
export function getCacheKey(params: Record<string, string | number>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return sortedParams;
}

/**
 * Clean up old cache entries (older than 7 days)
 */
export async function cleanOldCache(): Promise<void> {
  try {
    const db = getFirestore();
    const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const snapshot = await db
      .collection(CACHE_COLLECTION)
      .where("timestamp", "<", sevenDaysAgo)
      .get();

    if (snapshot.empty) {
      logger.info("No old cache entries to clean");
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    logger.info(`Cleaned ${snapshot.size} old cache entries`);
  } catch (error) {
    logger.error("Error cleaning old cache:", error);
  }
}
