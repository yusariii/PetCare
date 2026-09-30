/**
 * One-off backfill: (re)generate embeddings for Medical_Documents rows that are
 * missing one, e.g. after the embedding model changed. Run with: npm run reindex:docs
 */
require('dotenv').config();
const db = require('./db');
const { indexDocument } = require('../services/ragService');

const run = async () => {
  const [docs] = await db.query('SELECT id, title FROM Medical_Documents WHERE embedding IS NULL');

  if (docs.length === 0) {
    console.log('✅ Không có tài liệu nào cần tạo lại embedding.');
    process.exit(0);
  }

  console.log(`📌 Đang tạo embedding cho ${docs.length} tài liệu...`);
  for (const doc of docs) {
    try {
      await indexDocument(doc.id);
      console.log(`✅ Đã tạo embedding cho "${doc.title}"`);
    } catch (error) {
      console.error(`❌ Lỗi khi tạo embedding cho "${doc.title}": ${error.message}`);
    }
  }
  process.exit(0);
};

run().catch((error) => {
  console.error('❌ Không thể chạy reindex:', error.message);
  process.exit(1);
});
