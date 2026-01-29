#!/usr/bin/env node

/**
 * Monitor LiveResults getlastpassings API endpoint
 * Records responses with last_hash parameter at 30-second intervals
 * 
 * Usage: node monitor-last-passings.js <competitionId>
 * Example: node monitor-last-passings.js 12345
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
    console.error('Usage: node monitor-last-passings.js <competitionId>');
    process.exit(1);
  }
  return {
    competitionId: args[0],
  };
}

/**
 * Create data directory if it doesn't exist
 */
function ensureDataDir(competitionId) {
  const dir = path.join(process.cwd(), competitionId);
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
function fetchFromAPI(competitionId, lastHash) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      method: 'getlastpassings',
      comp: competitionId,
      unformattedTimes: 'false',
      lang: 'en',
    });

    if (lastHash) {
      params.append('last_hash', lastHash);
    }

    const urlWithParams = `${API_URL}?${params.toString()}`;

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
 * Main monitoring loop
 */
async function monitor(competitionId) {
  const dataDir = ensureDataDir(competitionId);
  let lastHash = null;
  let pollCount = 0;
  let notModifiedCount = 0;
  let newDataCount = 0;
  let errorCount = 0;

  console.log(`📊 Starting LiveResults monitoring for competition ${competitionId}`);
  console.log(`📁 Saving responses to: ${dataDir}`);
  console.log(`⏱️  Polling every 30 seconds (Press Ctrl+C to stop)\n`);

  const startTime = new Date();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    console.log('\n\n📈 Monitoring Summary:');
    console.log(`   Duration: ${duration} seconds`);
    console.log(`   Total polls: ${pollCount}`);
    console.log(`   New data: ${newDataCount}`);
    console.log(`   Not modified: ${notModifiedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('\n✅ Monitoring stopped');
    process.exit(0);
  });

  // Poll indefinitely
  while (true) {
    try {
      pollCount++;
      const timestamp = formatTimestamp();
      console.log(`\n[${new Date().toLocaleTimeString()}] Poll #${pollCount} (last_hash: ${lastHash ? lastHash.slice(0, 8) + '...' : 'none'})`);

      const response = await fetchFromAPI(competitionId, lastHash);

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

    // Wait 30 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }
}

// Run the monitor
const { competitionId } = parseArgs();
monitor(competitionId).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
