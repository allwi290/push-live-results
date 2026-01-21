/**
 * Push notification management using Firebase Cloud Messaging
 */

import {getMessaging} from "firebase-admin/messaging";
import {getFirestore} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {ResultEntry, UserSelection, NotificationPayload} from "./types";

const SELECTIONS_COLLECTION = "selections";

/**
 * Get all user selections for a specific competition and class
 */
export async function getUserSelections(
  competitionId: string,
  className: string
): Promise<UserSelection[]> {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection(SELECTIONS_COLLECTION)
      .where("competitionId", "==", competitionId)
      .where("className", "==", className)
      .get();

    return snapshot.docs.map((doc) => doc.data() as UserSelection);
  } catch (error) {
    logger.error("Error fetching user selections:", error);
    return [];
  }
}

/**
 * Send push notification to a user
 */
export async function sendPushNotification(
  fcmToken: string,
  payload: NotificationPayload
): Promise<void> {
  try {
    const messaging = getMessaging();
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
  } catch (error) {
    logger.error("Error sending notification:", error);
    throw error;
  }
}

/**
 * Compare results and send notifications for followed runners
 */
export async function notifyResultChanges(
  competitionId: string,
  className: string,
  oldResults: ResultEntry[],
  newResults: ResultEntry[]
): Promise<void> {
  try {
    // Get all users following this competition and class
    const selections = await getUserSelections(competitionId, className);

    if (selections.length === 0) {
      logger.info("No users following this competition/class");
      return;
    }

    // Create a map of old results for quick lookup
    const oldResultsMap = new Map<string, ResultEntry>();
    oldResults.forEach((result) => {
      oldResultsMap.set(result.name, result);
    });

    // Check each new result for changes
    for (const newResult of newResults) {
      const oldResult = oldResultsMap.get(newResult.name);

      // Find users following this runner
      const followers = selections.filter((selection) =>
        selection.runnerNames.includes(newResult.name)
      );

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
      } else if (oldResult.result !== newResult.result) {
        // Result changed
        shouldNotify = true;
        notificationBody = `${newResult.name} - ${newResult.result || "in progress"}`;
      } else if (oldResult.place !== newResult.place && newResult.place !== "") {
        // Place changed
        shouldNotify = true;
        notificationBody = `${newResult.name} now in place ${newResult.place}`;
      } else if (oldResult.status !== newResult.status) {
        // Status changed (DNS, DNF, etc.)
        shouldNotify = true;
        notificationBody = `${newResult.name} status changed: ${getStatusText(newResult.status)}`;
      }

      if (shouldNotify) {
        const payload: NotificationPayload = {
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
          .map((follower) =>
            sendPushNotification(follower.fcmToken as string, payload)
          );

        await Promise.allSettled(notificationPromises);
      }
    }
  } catch (error) {
    logger.error("Error processing result changes:", error);
  }
}

/**
 * Get human-readable status text
 */
function getStatusText(status: number): string {
  const statusMap: Record<number, string> = {
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
export async function cleanOldSelections(): Promise<void> {
  try {
    const db = getFirestore();
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
  } catch (error) {
    logger.error("Error cleaning old selections:", error);
  }
}
