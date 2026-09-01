#!/usr/bin/env node

/**
 * Database Initialization Script
 * Sử dụng: node src/config/setupDb.js
 */

const initDatabase = require('./initDatabase');

initDatabase()
  .then(() => {
    console.log('\n✅ Database setup hoàn tất!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Database setup thất bại:', error);
    process.exit(1);
  });
