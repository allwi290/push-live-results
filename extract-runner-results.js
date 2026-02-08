#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const [competitionId, className, runnerName] = process.argv.slice(2);

if (!competitionId || !className || !runnerName) {
  console.error('Usage: node extract-runner-results.js <competitionId> <class> <runnerName>');
  console.error('Example: node extract-runner-results.js 35680 D17-20 "Hanna Schälin"');
  process.exit(1);
}

const classDir = path.join(__dirname, 'data', competitionId, 'classresults', className);

if (!fs.existsSync(classDir)) {
  console.error(`Directory not found: ${classDir}`);
  process.exit(1);
}

const files = fs.readdirSync(classDir)
  .filter(f => f.startsWith('data_') && f.endsWith('.json'))
  .sort();

const output = {};
const seenJson = new Set();

for (const file of files) {
  const match = file.match(/^data_(.+)_([a-f0-9]+|none)\.json$/);
  if (!match) continue;

  const timestamp = match[1];

  try {
    const data = JSON.parse(fs.readFileSync(path.join(classDir, file), 'utf8'));
    const results = data.response?.results;
    if (!results) continue;

    const runner = results.find(r => r.name === runnerName);
    if (!runner) continue;

    const key = JSON.stringify(runner);
    if (seenJson.has(key)) continue;

    seenJson.add(key);
    output[timestamp] = runner;
  } catch (err) {
    console.error(`Error reading ${file}: ${err.message}`);
  }
}

const outputFile = `${runnerName.replace(/[^a-zA-ZåäöÅÄÖ0-9_-]/g, '_')}_${competitionId}_${className}.json`;
fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');
console.log(`Wrote ${Object.keys(output).length} unique results to ${outputFile}`);
