const ai = require('../config/gemini');
const db = require('../config/db');

// text-embedding-004 was retired; gemini-embedding-001 is the current stable text embedding model.
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
// Minimum cosine similarity for a document to be considered relevant; below this
// the AI must admit it doesn't have enough grounded information instead of guessing.
const MIN_RELEVANCE_SCORE = 0.55;

/**
 * Generate an embedding vector for a piece of text using Gemini.
 * @param {string} text
 * @param {'RETRIEVAL_DOCUMENT'|'RETRIEVAL_QUERY'} taskType
 */
const generateEmbedding = async (text, taskType = 'RETRIEVAL_DOCUMENT') => {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  return response.embeddings?.[0]?.values || [];
};

const cosineSimilarity = (a, b) => {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * (Re)generate and persist the embedding for a knowledge base document.
 */
const indexDocument = async (documentId) => {
  const [rows] = await db.query(
    'SELECT id, title, category, content FROM Medical_Documents WHERE id = ?',
    [documentId]
  );
  if (rows.length === 0) return null;

  const doc = rows[0];
  const embedding = await generateEmbedding(`${doc.title}\n${doc.category || ''}\n${doc.content}`, 'RETRIEVAL_DOCUMENT');
  await db.query('UPDATE Medical_Documents SET embedding = ? WHERE id = ?', [JSON.stringify(embedding), documentId]);
  return embedding;
};

/**
 * BR05-RAG: Retrieve the doctor-provided documents most relevant to a query so the
 * AI grounds its consultation in real medical content instead of inventing one.
 */
const retrieveRelevantDocuments = async ({ query, species, topK = 4 }) => {
  const [docs] = await db.query(
    `SELECT id, title, category, content, embedding
     FROM Medical_Documents
     WHERE is_active = TRUE AND embedding IS NOT NULL
       AND (species = 'all' OR species = ?)`,
    [species || 'all']
  );

  if (docs.length === 0) return [];

  const queryEmbedding = await generateEmbedding(query, 'RETRIEVAL_QUERY');
  if (!queryEmbedding.length) return [];

  return docs
    .map((doc) => {
      let vector = [];
      try { vector = JSON.parse(doc.embedding); } catch (_) { vector = []; }
      return {
        id: doc.id,
        title: doc.title,
        category: doc.category,
        content: doc.content,
        score: cosineSimilarity(queryEmbedding, vector),
      };
    })
    .filter((doc) => doc.score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

module.exports = {
  generateEmbedding,
  cosineSimilarity,
  indexDocument,
  retrieveRelevantDocuments,
  MIN_RELEVANCE_SCORE,
};
