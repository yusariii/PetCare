#!/usr/bin/env node

/**
 * Seed Data Script
 * Sử dụng: node src/config/runSeed.js
 */

const seedData = require('./seedData');

seedData()
  .then(() => {
    console.log('\n✅ Seed data setup hoàn tất!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seed data setup thất bại:', error);
    process.exit(1);
  });
