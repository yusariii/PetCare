const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

router.use(verifyToken);
// Knowledge base documents power the RAG-grounded AI consultation; only admin curates them.
router.use(requireRole('admin'));

router.post('/', documentController.createDocument);
router.get('/', documentController.listDocuments);
router.put('/:id', documentController.updateDocument);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
