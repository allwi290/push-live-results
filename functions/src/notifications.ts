/**
 * Push notification management using Firebase Cloud Messaging
 *
 * Detects meaningful changes in runner results and sends targeted
 * notifications to followers. Change types detected:
 *   - Radio control passings (new split time with place & time behind)
 *   - Race finish (result time, place, time behind winner)
 *   - Status problems (MP, DNF, DSQ, DNS, OT)
 */

import {getMessaging} from "firebase-admin/messaging";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {
  ResultEntry,
  UserSelection,
  NotificationPayload,
  LastPassing,
  SplitControl,
} from "./types";

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
 * Process new passings and send notifications to followers
 */
export async function notifyPassingChanges(
  competitionId: string,
  passings: LastPassing[]
): Promise<void> {
  try {
    // Get all selections for this competition
    const db = getFirestore();
    const snapshot = await db
      .collection(SELECTIONS_COLLECTION)
      .where("competitionId", "==", competitionId)
      .get();

    if (snapshot.empty) {
      logger.info(`No users following competition ${competitionId}`);
      return;
    }

    const selections = snapshot.docs.map((doc) => doc.data() as UserSelection);

    // Process each passing and notify relevant users
    for (const passing of passings) {
      // Find users following this runner in this class
      const followers = selections.filter(
        (selection) =>
          selection.className === passing.class &&
          selection.runnerName === passing.runnerName
      );

      if (followers.length === 0) {
        continue;
      }

      // Create notification payload
      const payload: NotificationPayload = {
        title: `${passing.class} - ${passing.controlName}`,
        body: `${passing.runnerName} passed ${passing.controlName} at ${passing.passtime}`,
        data: {
          competitionId,
          className: passing.class,
          runnerName: passing.runnerName,
          control: passing.control.toString(),
          controlName: passing.controlName,
          passtime: passing.passtime,
        },
      };

      // Send notification to all followers of this runner
      const notificationPromises = followers
        .filter((follower) => follower.fcmToken)
        .map((follower) =>
          sendPushNotification(follower.fcmToken as string, payload)
        );

      await Promise.allSettled(notificationPromises);
      logger.info(
        `Notifications sent for passing: ${passing.runnerName} at ${passing.controlName}`,
        payload
      );
    }
  } catch (error) {
    logger.error("Error processing passing changes:", error);
  }
}

/**
 * Compare results and send notifications for followed runners.
 *
 * Detects three categories of changes by comparing old vs new result entries:
 *  1. New radio control passing — a split time appeared for a control
 *  2. Runner finished — progress reached 100 and result/status appeared
 *  3. Status problem — status changed to MP/DNF/DSQ/OT etc.
 *
 * @param splitcontrols  Radio control metadata from the getclassresults API
 *   response; maps control codes (e.g. 1065) to names (e.g. "Radio K65").
 */
export async function notifyResultChanges(
  competitionId: string,
  className: string,
  oldResults: ResultEntry[],
  newResults: ResultEntry[],
  splitcontrols: SplitControl[] = []
): Promise<void> {
  try {
    // Get all users following this competition and class
    const selections = await getUserSelections(competitionId, className);

    if (selections.length === 0) {
      return;
    }

    // Index old results by runner name for O(1) lookup
    const oldResultsMap = new Map<string, ResultEntry>();
    for (const result of oldResults) {
      oldResultsMap.set(result.name, result);
    }

    // Check each new result for changes
    for (const newResult of newResults) {
      const oldResult = oldResultsMap.get(newResult.name);
      if (!oldResult) {
        // First time seeing this runner — no baseline to compare
        continue;
      }

      // Find users following this specific runner
      const followers = selections.filter(
        (s) => s.runnerName === newResult.name
      );
      if (followers.length === 0) {
        continue;
      }

      // Detect changes and build notification payloads
      const payloads = detectResultChanges(
        oldResult,
        newResult,
        className,
        competitionId,
        splitcontrols
      );

      // Send each payload to all followers
      for (const payload of payloads) {
        await sendToFollowers(followers, payload);
      }
    }
  } catch (error) {
    logger.error("Error processing result changes:", error);
  }
}

/**
 * Build notification payloads for changes between an old and new result entry.
 */
function detectResultChanges(
  oldResult: ResultEntry,
  newResult: ResultEntry,
  className: string,
  competitionId: string,
  splitcontrols: SplitControl[]
): NotificationPayload[] {
  const payloads: NotificationPayload[] = [];

  // --- 1. New radio control passings ---
  if (newResult.splits && splitcontrols.length > 0) {
    for (const control of splitcontrols) {
      const code = control.code.toString();
      const oldSplit = oldResult.splits?.[code];
      const newSplit = newResult.splits[code];

      // Split went from empty to a numeric value → runner passed this control
      const hadNoSplit = oldSplit === undefined || oldSplit === "";
      const hasNewSplit = newSplit !== undefined && newSplit !== "";

      if (hadNoSplit && hasNewSplit) {
        const place = newResult.splits[`${code}_place`];
        const timeplus = newResult.splits[`${code}_timeplus`];

        let body = `${newResult.name} passed ${control.name}`;

        if (place !== undefined && place !== "" && place !== "-") {
          body += `, ${ordinal(Number(place))} place`;
        }

        if (typeof timeplus === "number") {
          body +=
            timeplus === 0
              ? " (leading!)"
              : ` (+${formatCentiseconds(timeplus)})`;
        }

        payloads.push({
          title: `${className} — ${control.name}`,
          body,
          data: {
            competitionId,
            className,
            runnerName: newResult.name,
            type: "split",
            control: code,
          },
        });
      }
    }
  }

  // --- 2. Runner finished ---
  const wasRunning = (oldResult.progress ?? 0) < 100;
  const nowFinished = (newResult.progress ?? 0) >= 100;

  if (wasRunning && nowFinished) {
    if (newResult.status === 0) {
      // Successful finish
      let body = `${newResult.name} finished in ${newResult.result}`;
      if (newResult.place && newResult.place !== "" && newResult.place !== "-") {
        body += `, ${ordinal(Number(newResult.place))} place`;
      }
      if (
        newResult.timeplus &&
        newResult.timeplus !== "+" &&
        newResult.timeplus !== ""
      ) {
        body += ` (${newResult.timeplus})`;
      }

      payloads.push({
        title: `${className} — Finished!`,
        body,
        data: {
          competitionId,
          className,
          runnerName: newResult.name,
          type: "finish",
        },
      });
    } else {
      // Finished with a problem status (MP, DNF, etc.)
      const statusText = getStatusText(newResult.status);
      payloads.push({
        title: `${className} — ${statusText}`,
        body: `${newResult.name} — ${statusText}`,
        data: {
          competitionId,
          className,
          runnerName: newResult.name,
          type: "status",
        },
      });
    }
  }

  // --- 3. Status changed to a problem while still in race ---
  // (not already covered by finish detection above)
  if (
    !(wasRunning && nowFinished) &&
    oldResult.status !== newResult.status &&
    newResult.status !== 0 &&
    newResult.status !== 9 &&
    newResult.status !== 10
  ) {
    const statusText = getStatusText(newResult.status);
    payloads.push({
      title: `${className} — ${statusText}`,
      body: `${newResult.name} — ${statusText}`,
      data: {
        competitionId,
        className,
        runnerName: newResult.name,
        type: "status",
      },
    });
  }

  return payloads;
}

/**
 * Send a notification payload to all followers that have an FCM token.
 */
async function sendToFollowers(
  followers: UserSelection[],
  payload: NotificationPayload
): Promise<void> {
  const promises = followers
    .filter((f) => f.fcmToken)
    .map((f) => sendPushNotification(f.fcmToken as string, payload));
  await Promise.allSettled(promises);
  logger.info(`Notification: ${payload.title} — ${payload.body}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format centiseconds (1/100 s) to mm:ss string
 */
function formatCentiseconds(cs: number): string {
  const totalSeconds = Math.floor(cs / 100);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * English ordinal suffix for a number (1st, 2nd, 3rd, …)
 */
function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  switch (n % 10) {
  case 1:
    return `${n}st`;
  case 2:
    return `${n}nd`;
  case 3:
    return `${n}rd`;
  default:
    return `${n}th`;
  }
}

/**
 * Get human-readable status text
 */
function getStatusText(status: number): string {
  const statusMap: Record<number, string> = {
    0: "OK",
    1: "Did Not Start",
    2: "Did Not Finish",
    3: "Mispunch",
    4: "Disqualified",
    5: "Over Time",
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
    const thirtyDaysAgo = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);

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
