const db = require('../config/db');
const { indexDocument } = require('../services/ragService');

const VALID_SPECIES = ['dog', 'cat', 'other', 'all'];

/**
 * Create a RAG knowledge base document (doctor only)
 * POST /api/documents
 */
exports.createDocument = async (req, res) => {
  try {
    const { title, species, category, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tiêu đề và nội dung tài liệu'
      });
    }

    const finalSpecies = VALID_SPECIES.includes(species) ? species : 'all';

    const [result] = await db.query(
      'INSERT INTO Medical_Documents (doctor_id, title, species, category, content) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, title, finalSpecies, category || null, content]
    );

    // Index for RAG retrieval; embedding failure shouldn't block document creation
    try {
      await indexDocument(result.insertId);
    } catch (embedError) {
      console.error('DOCUMENT_EMBEDDING_ERROR:', embedError.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Đã thêm tài liệu vào cơ sở tri thức AI',
      data: { document_id: result.insertId }
    });
  } catch (error) {
    console.error('CREATE_DOCUMENT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi thêm tài liệu. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all knowledge base documents (doctor only)
 * GET /api/documents
 */
exports.listDocuments = async (req, res) => {
  try {
    const [docs] = await db.query(`
      SELECT d.id, d.title, d.species, d.category, d.content, d.is_active, d.created_at,
             u.full_name as doctor_name
      FROM Medical_Documents d
      JOIN Users u ON d.doctor_id = u.id
      ORDER BY d.created_at DESC
    `);

    return res.status(200).json({ success: true, data: docs });
  } catch (error) {
    console.error('LIST_DOCUMENTS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách tài liệu. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update a knowledge base document and regenerate its embedding (doctor only)
 * PUT /api/documents/:id
 */
exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, species, category, content, is_active } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tiêu đề và nội dung tài liệu'
      });
    }

    const [docs] = await db.query('SELECT id FROM Medical_Documents WHERE id = ?', [id]);
    if (docs.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu' });
    }

    const finalSpecies = VALID_SPECIES.includes(species) ? species : 'all';

    await db.query(
      'UPDATE Medical_Documents SET title = ?, species = ?, category = ?, content = ?, is_active = ? WHERE id = ?',
      [title, finalSpecies, category || null, content, is_active === undefined ? true : !!is_active, id]
    );

    try {
      await indexDocument(id);
    } catch (embedError) {
      console.error('DOCUMENT_EMBEDDING_ERROR:', embedError.message);
    }

    return res.status(200).json({ success: true, message: 'Đã cập nhật tài liệu' });
  } catch (error) {
    console.error('UPDATE_DOCUMENT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật tài liệu. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a knowledge base document (doctor only)
 * DELETE /api/documents/:id
 */
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM Medical_Documents WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu' });
    }

    return res.status(200).json({ success: true, message: 'Đã xóa tài liệu' });
  } catch (error) {
    console.error('DELETE_DOCUMENT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa tài liệu. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
