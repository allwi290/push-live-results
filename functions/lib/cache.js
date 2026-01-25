"use strict";
/**
 * Firestore cache management for LiveResults API responses
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
exports.CACHE_TTL = void 0;
exports.getCachedData = getCachedData;
exports.setCachedData = setCachedData;
exports.getCacheKey = getCacheKey;
exports.cleanOldCache = cleanOldCache;
const firestore_1 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const CACHE_COLLECTION = "api_cache";
// Cache TTL constants
exports.CACHE_TTL = {
    COMPETITIONS: 60 * 60 * 1000, // 1 hour
    CLASSES: 15 * 60 * 1000, // 15 minutes
    CLASS_RESULTS: 15 * 60 * 1000, // 15 minutes
    LAST_PASSINGS: 15 * 1000, // 15 seconds
    CLUBS: 15 * 60 * 1000, // 15 minutes
    CLUB_RUNNERS: 15 * 60 * 1000, // 15 minutes
};
/**
 * Get cached data from Firestore
 */
async function getCachedData(cacheKey, ttlMs) {
    try {
        const db = (0, firestore_1.getFirestore)();
        const docRef = db.collection(CACHE_COLLECTION).doc(cacheKey);
        const doc = await docRef.get();
        if (!doc.exists) {
            return null;
        }
        const data = doc.data();
        const now = Date.now();
        // Check if cache is expired
        if (now - data.timestamp > ttlMs) {
            logger.info(`Cache expired for key: ${cacheKey}`);
            return null;
        }
        logger.info(`Cache hit for key: ${cacheKey}`);
        return data;
    }
    catch (error) {
        // Silently fail for cache reads - caching is optional
        // This is especially common during emulator startup
        return null;
    }
}
/**
 * Save data to Firestore cache
 */
async function setCachedData(cacheKey, hash, data) {
    try {
        const db = (0, firestore_1.getFirestore)();
        const docRef = db.collection(CACHE_COLLECTION).doc(cacheKey);
        const cachedData = {
            hash,
            data,
            timestamp: Date.now(),
        };
        await docRef.set(cachedData);
        logger.info(`Cache updated for key: ${cacheKey}`);
    }
    catch (error) {
        // Silently fail for cache writes - caching is optional
        // This is especially common during emulator startup
        if (error instanceof Error) {
            logger.debug(`Cache write failed (${error.message})`);
        }
    }
}
/**
 * Generate cache key from parameters
 */
function getCacheKey(params) {
    const sortedParams = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&");
    return sortedParams;
}
/**
 * Clean up old cache entries (older than 7 days)
 */
async function cleanOldCache() {
    try {
        const db = (0, firestore_1.getFirestore)();
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
    }
    catch (error) {
        logger.error("Error cleaning old cache:", error);
    }
}
//# sourceMappingURL=cache.js.map