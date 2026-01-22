"use strict";
/**
 * Push notification management using Firebase Cloud Messaging
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
exports.getUserSelections = getUserSelections;
exports.sendPushNotification = sendPushNotification;
exports.notifyResultChanges = notifyResultChanges;
exports.cleanOldSelections = cleanOldSelections;
const messaging_1 = require("firebase-admin/messaging");
const firestore_1 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const SELECTIONS_COLLECTION = "selections";
/**
 * Get all user selections for a specific competition and class
 */
async function getUserSelections(competitionId, className) {
    try {
        const db = (0, firestore_1.getFirestore)();
        const snapshot = await db
            .collection(SELECTIONS_COLLECTION)
            .where("competitionId", "==", competitionId)
            .where("className", "==", className)
            .get();
        return snapshot.docs.map((doc) => doc.data());
    }
    catch (error) {
        logger.error("Error fetching user selections:", error);
        return [];
    }
}
/**
 * Send push notification to a user
 */
async function sendPushNotification(fcmToken, payload) {
    try {
        const messaging = (0, messaging_1.getMessaging)();
        await messaging.send({
            token: fcmToken,
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data,
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                    },
                },
            },
        });
        logger.info(`Notification sent to token: ${fcmToken.substring(0, 10)}...`);
    }
    catch (error) {
        logger.error("Error sending notification:", error);
        throw error;
    }
}
/**
 * Compare results and send notifications for followed runners
 */
async function notifyResultChanges(competitionId, className, oldResults, newResults) {
    try {
        // Get all users following this competition and class
        const selections = await getUserSelections(competitionId, className);
        if (selections.length === 0) {
            logger.info("No users following this competition/class");
            return;
        }
        // Create a map of old results for quick lookup
        const oldResultsMap = new Map();
        oldResults.forEach((result) => {
            oldResultsMap.set(result.name, result);
        });
        // Check each new result for changes
        for (const newResult of newResults) {
            const oldResult = oldResultsMap.get(newResult.name);
            // Find users following this runner
            const followers = selections.filter((selection) => selection.runnerNames.includes(newResult.name));
            if (followers.length === 0) {
                continue;
            }
            // Determine if we should notify
            let shouldNotify = false;
            let notificationBody = "";
            if (!oldResult) {
                // New runner appeared
                shouldNotify = true;
                notificationBody = `${newResult.name} has started - ${newResult.result || "in progress"}`;
            }
            else if (oldResult.result !== newResult.result) {
                // Result changed
                shouldNotify = true;
                notificationBody = `${newResult.name} - ${newResult.result || "in progress"}`;
            }
            else if (oldResult.place !== newResult.place && newResult.place !== "") {
                // Place changed
                shouldNotify = true;
                notificationBody = `${newResult.name} now in place ${newResult.place}`;
            }
            else if (oldResult.status !== newResult.status) {
                // Status changed (DNS, DNF, etc.)
                shouldNotify = true;
                notificationBody = `${newResult.name} status changed: ${getStatusText(newResult.status)}`;
            }
            if (shouldNotify) {
                const payload = {
                    title: `${className} Update`,
                    body: notificationBody,
                    data: {
                        competitionId,
                        className,
                        runnerName: newResult.name,
                    },
                };
                // Send notification to all followers of this runner
                const notificationPromises = followers
                    .filter((follower) => follower.fcmToken)
                    .map((follower) => sendPushNotification(follower.fcmToken, payload));
                await Promise.allSettled(notificationPromises);
            }
        }
    }
    catch (error) {
        logger.error("Error processing result changes:", error);
    }
}
/**
 * Get human-readable status text
 */
function getStatusText(status) {
    const statusMap = {
        0: "OK",
        1: "DNS",
        2: "DNF",
        3: "MP",
        4: "DSQ",
        5: "OT",
        9: "Not Started",
        10: "Not Started",
        11: "Walk Over",
        12: "Moved",
    };
    return statusMap[status] || "Unknown";
}
/**
 * Clean up old selections (after event end)
 */
async function cleanOldSelections() {
    try {
        const db = (0, firestore_1.getFirestore)();
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const snapshot = await db
            .collection(SELECTIONS_COLLECTION)
            .where("createdAt", "<", thirtyDaysAgo)
            .get();
        if (snapshot.empty) {
            logger.info("No old selections to clean");
            return;
        }
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        logger.info(`Cleaned ${snapshot.size} old selections`);
    }
    catch (error) {
        logger.error("Error cleaning old selections:", error);
    }
}
//# sourceMappingURL=notifications.js.map