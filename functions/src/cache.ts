/**
 * Firestore cache management for LiveResults API responses
 */

import {getFirestore} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {CachedData} from "./types";

const CACHE_COLLECTION = "api_cache";
const CACHE_TTL_MS = 15 * 1000; // 15 seconds (matches LiveResults API cache)

/**
 * Get cached data from Firestore
 */
export async function getCachedData(
  cacheKey: string
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

    // Check if cache is expired
    if (now - data.timestamp > CACHE_TTL_MS) {
      logger.info(`Cache expired for key: ${cacheKey}`);
      return null;
    }

    logger.info(`Cache hit for key: ${cacheKey}`);
    return data;
  } catch (error) {
    logger.error("Error reading from cache:", error);
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
      timestamp: Date.now(),
    };

    await docRef.set(cachedData);
    logger.info(`Cache updated for key: ${cacheKey}`);
  } catch (error) {
    logger.error("Error writing to cache:", error);
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
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

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
