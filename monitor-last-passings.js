#!/usr/bin/env node

/**
 * Monitor LiveResults API endpoints
 * Records responses with last_hash parameter at 30-second intervals
 * 
 * Usage: 
 *   node monitor-last-passings.js <competitionId> [endpoint]
 * 
 * Examples:
 *   node monitor-last-passings.js 12345 getlastpassings   # Monitor last passings only
 *   node monitor-last-passings.js 12345 classresults      # Monitor class results only
 *   node monitor-last-passings.js 12345 all               # Monitor both (default)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_URL = 'https://liveresultat.orientering.se/api.php';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node monitor-last-passings.js <competitionId> [endpoint]');
    console.error('Endpoints: getlastpassings, classresults, all (default)');
    process.exit(1);
  }
  return {
    competitionId: args[0],
    endpoint: args[1] || 'all', // 'getlastpassings', 'classresults', or 'all'
  };
}

/**
 * Create data directory if it doesn't exist
 */
function ensureDataDir(competitionId, subdir = '') {
  const basePath = path.join(process.cwd(), competitionId);
  const dir = subdir ? path.join(basePath, subdir) : basePath;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Format timestamp for filename
 */
function formatTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}:${minutes}:${seconds}`;
}

/**
 * Fetch from LiveResults API
 */
function fetchFromAPI(params) {
  return new Promise((resolve, reject) => {
    const urlWithParams = `${API_URL}?${new URLSearchParams(params).toString()}`;

    https.get(urlWithParams, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          // Sanitize control characters
          const sanitized = data.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
          const parsed = JSON.parse(sanitized);
          resolve({
            status: response.statusCode,
            data: parsed,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          reject(new Error(`Failed to parse JSON response: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Save response to file
 */
function saveResponse(dataDir, timestamp, lastHash, response) {
  const hashStr = lastHash ? lastHash.slice(0, 8) : 'none';
  const filename = `data_${timestamp}_${hashStr}.json`;
  const filepath = path.join(dataDir, filename);

  const output = {
    timestamp: response.timestamp,
    lastHashUsed: lastHash || null,
    statusCode: response.status,
    response: response.data,
  };

  fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
  return filename;
}

/**
 * Fetch all classes for a competition
 */
async function fetchClasses(competitionId) {
  try {
    const response = await fetchFromAPI({
      method: 'getclasses',
      comp: competitionId,
      lang: 'en',
    });

    if (response.data.status === 'OK' && response.data.classes) {
      return response.data.classes.map((c) => c.className);
    }
    return [];
  } catch (error) {
    console.error('Error fetching classes:', error.message);
    return [];
  }
}

/**
 * Monitor getlastpassings endpoint
 */
async function monitorLastPassings(competitionId) {
  const dataDir = ensureDataDir(competitionId, 'lastpassings');
  let lastHash = null;
  let pollCount = 0;
  let notModifiedCount = 0;
  let newDataCount = 0;
  let errorCount = 0;

  console.log(`\n📊 Starting getlastpassings monitoring for competition ${competitionId}`);
  console.log(`📁 Saving responses to: ${dataDir}`);
  console.log(`⏱️  Polling every 30 seconds (Press Ctrl+C to stop)\n`);

  const startTime = new Date();

  return {
    async poll() {
      try {
        pollCount++;
        const timestamp = formatTimestamp();
        console.log(
          `\n[${new Date().toLocaleTimeString()}] getlastpassings Poll #${pollCount} (last_hash: ${
            lastHash ? lastHash.slice(0, 8) + '...' : 'none'
          })`
        );

        const params = {
          method: 'getlastpassings',
          comp: competitionId,
          unformattedTimes: 'false',
          lang: 'en',
        };

        if (lastHash) {
          params.last_hash = lastHash;
        }

        const response = await fetchFromAPI(params);

        if (response.status === 304 || response.data.status === 'NOT MODIFIED') {
          notModifiedCount++;
          console.log(`   ℹ️  NOT MODIFIED (hash unchanged)`);
        } else if (response.data.status === 'OK' || response.data.status === undefined) {
          newDataCount++;
          const filename = saveResponse(dataDir, timestamp, lastHash, response);
          console.log(`   ✅ New data received`);
          console.log(`   📄 Saved: ${filename}`);

          if (response.data.hash) {
            lastHash = response.data.hash;
            console.log(`   🔐 Hash updated: ${lastHash.slice(0, 8)}...`);
          }

          const passings = response.data.passings || [];
          console.log(`   📍 Passings count: ${passings.length}`);
        } else {
          console.log(`   ⚠️  Unexpected status: ${response.data.status}`);
        }
      } catch (error) {
        errorCount++;
        console.log(`   ❌ Error: ${error.message}`);
      }
    },

    getStats() {
      const endTime = new Date();
      const duration = Math.round((endTime - startTime) / 1000);
      return { duration, pollCount, newDataCount, notModifiedCount, errorCount };
    },
  };
}

/**
 * Monitor classresults endpoints
 */
async function monitorClassResults(competitionId) {
  console.log(`\n📊 Fetching classes for competition ${competitionId}...`);
  const classes = await fetchClasses(competitionId);

  if (classes.length === 0) {
    console.log('   ⚠️  No classes found for this competition');
    return {
      async poll() {
        // No-op
      },
      getStats() {
        return { duration: 0, pollCount: 0, newDataCount: 0, notModifiedCount: 0, errorCount: 0 };
      },
    };
  }

  console.log(`   ✅ Found ${classes.length} classes: ${classes.join(', ')}`);

  const classTrackers = {};
  const startTime = new Date();

  // Initialize tracker for each class
  for (const className of classes) {
    classTrackers[className] = {
      lastHash: null,
      pollCount: 0,
      newDataCount: 0,
      notModifiedCount: 0,
      errorCount: 0,
      dataDir: ensureDataDir(competitionId, `classresults/${className}`),
    };
  }

  console.log(
    `\n📁 Saving classresults to: ${path.join(process.cwd(), competitionId, 'classresults')}`
  );
  console.log(`⏱️  Polling every 30 seconds (Press Ctrl+C to stop)\n`);

  return {
    async poll() {
      for (const className of classes) {
        const tracker = classTrackers[className];

        try {
          tracker.pollCount++;
          const timestamp = formatTimestamp();
          console.log(
            `\n[${new Date().toLocaleTimeString()}] classresults [${className}] Poll #${
              tracker.pollCount
            } (last_hash: ${tracker.lastHash ? tracker.lastHash.slice(0, 8) + '...' : 'none'})`
          );

          const params = {
            method: 'getclassresults',
            comp: competitionId,
            class: className,
            lang: 'en',
          };

          if (tracker.lastHash) {
            params.last_hash = tracker.lastHash;
          }

          const response = await fetchFromAPI(params);

          if (response.status === 304 || response.data.status === 'NOT MODIFIED') {
            tracker.notModifiedCount++;
            console.log(`   ℹ️  NOT MODIFIED (hash unchanged)`);
          } else if (response.data.status === 'OK' || response.data.status === undefined) {
            tracker.newDataCount++;
            const filename = saveResponse(tracker.dataDir, timestamp, tracker.lastHash, response);
            console.log(`   ✅ New data received`);
            console.log(`   📄 Saved: ${filename}`);

            if (response.data.hash) {
              tracker.lastHash = response.data.hash;
              console.log(`   🔐 Hash updated: ${tracker.lastHash.slice(0, 8)}...`);
            }

            const results = response.data.data || response.data.results || [];
            console.log(`   📋 Results count: ${results.length}`);
          } else {
            console.log(`   ⚠️  Unexpected status: ${response.data.status}`);
          }
        } catch (error) {
          tracker.errorCount++;
          console.log(`   ❌ Error: ${error.message}`);
        }
      }
    },

    getStats() {
      const endTime = new Date();
      const duration = Math.round((endTime - startTime) / 1000);
      const totals = {
        duration,
        pollCount: 0,
        newDataCount: 0,
        notModifiedCount: 0,
        errorCount: 0,
      };

      for (const tracker of Object.values(classTrackers)) {
        totals.pollCount += tracker.pollCount;
        totals.newDataCount += tracker.newDataCount;
        totals.notModifiedCount += tracker.notModifiedCount;
        totals.errorCount += tracker.errorCount;
      }

      return { ...totals, classStats: classTrackers };
    },
  };
}

/**
 * Main monitoring loop
 */
async function monitor(competitionId, endpointType) {
  const monitors = {};

  if (endpointType === 'getlastpassings' || endpointType === 'all') {
    monitors.lastPassings = await monitorLastPassings(competitionId);
  }

  if (endpointType === 'classresults' || endpointType === 'all') {
    monitors.classResults = await monitorClassResults(competitionId);
  }

  const startTime = new Date();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log('\n\n📈 Monitoring Summary:');
    console.log(`   Total Duration: ${duration} seconds`);

    if (monitors.lastPassings) {
      const stats = monitors.lastPassings.getStats();
      console.log('\n   getlastpassings:');
      console.log(`      Total polls: ${stats.pollCount}`);
      console.log(`      New data: ${stats.newDataCount}`);
      console.log(`      Not modified: ${stats.notModifiedCount}`);
      console.log(`      Errors: ${stats.errorCount}`);
    }

    if (monitors.classResults) {
      const stats = monitors.classResults.getStats();
      console.log('\n   classresults:');
      console.log(`      Total polls: ${stats.pollCount}`);
      console.log(`      New data: ${stats.newDataCount}`);
      console.log(`      Not modified: ${stats.notModifiedCount}`);
      console.log(`      Errors: ${stats.errorCount}`);

      if (stats.classStats) {
        console.log('\n   Per-class statistics:');
        for (const [className, classTracker] of Object.entries(stats.classStats)) {
          console.log(`      ${className}:`);
          console.log(`         polls: ${classTracker.pollCount}, new: ${classTracker.newDataCount}, unchanged: ${classTracker.notModifiedCount}, errors: ${classTracker.errorCount}`);
        }
      }
    }

    console.log('\n✅ Monitoring stopped');
    process.exit(0);
  });

  // Poll indefinitely
  while (true) {
    if (monitors.lastPassings) {
      await monitors.lastPassings.poll();
    }

    if (monitors.classResults) {
      await monitors.classResults.poll();
    }

    // Wait 30 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }
}

// Run the monitor
const { competitionId, endpoint } = parseArgs();
monitor(competitionId, endpoint).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
