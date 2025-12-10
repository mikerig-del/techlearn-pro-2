const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/database');
const { authenticateToken } = require('./auth');
const contentProcessor = require('../services/contentProcessor');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadDir = 'uploads/documents';
    if (file.mimetype.startsWith('video/')) {
      uploadDir = 'uploads/videos';
    } else if (file.mimetype.startsWith('image/')) {
      uploadDir = 'uploads/images';
    }
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 500000000 }, // 500MB default
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'image/jpeg',
      'image/png',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported`));
    }
  }
});

// Upload content
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description } = req.body;
    const contentId = 'content-' + uuidv4();
    
    const filePath = req.file.path;
    const fileUrl = `/${filePath}`;
    const contentType = req.file.mimetype.split('/')[0]; // video, application, image

    // Insert content record
    await db.run(
      `INSERT INTO content_items 
       (id, title, description, content_type, file_path, file_url, status, created_by, organization_id)
       VALUES (?, ?, ?, ?, ?, ?, 'processing', ?, ?)`,
      [
        contentId,
        title || req.file.originalname,
        description || '',
        contentType,
        filePath,
        fileUrl,
        req.userId,
        req.organizationId
      ]
    );

    // Process content asynchronously
    contentProcessor.processContent(contentId, filePath, req.file.mimetype)
      .catch(err => console.error('Content processing error:', err));

    res.status(201).json({
      message: 'Content uploaded successfully',
      contentId,
      status: 'processing'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// Get all content items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, contentType } = req.query;
    
    let query = `
      SELECT c.*, u.full_name as created_by_name
      FROM content_items c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.organization_id = ?
    `;
    const params = [req.organizationId];

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    if (contentType) {
      query += ' AND c.content_type = ?';
      params.push(contentType);
    }

    query += ' ORDER BY c.created_at DESC';

    const items = await db.all(query, params);
    res.json(items);
  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({ error: 'Failed to get content' });
  }
});

// Get single content item
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const content = await db.get(
      `SELECT c.*, u.full_name as created_by_name
       FROM content_items c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ? AND c.organization_id = ?`,
      [req.params.id, req.organizationId]
    );

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Parse extracted data if exists
    if (content.extracted_data) {
      content.extracted_data = JSON.parse(content.extracted_data);
    }

    res.json(content);
  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({ error: 'Failed to get content' });
  }
});

// Update content item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, status } = req.body;
    
    await db.run(
      `UPDATE content_items 
       SET title = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [title, description, status, req.params.id, req.organizationId]
    );

    res.json({ message: 'Content updated successfully' });
  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({ error: 'Failed to update content' });
  }
});

// Delete content item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Get file path
    const content = await db.get(
      'SELECT file_path FROM content_items WHERE id = ? AND organization_id = ?',
      [req.params.id, req.organizationId]
    );

    if (content && content.file_path) {
      // Delete physical file
      if (fs.existsSync(content.file_path)) {
        fs.unlinkSync(content.file_path);
      }
    }

    // Delete from database
    await db.run(
      'DELETE FROM content_items WHERE id = ? AND organization_id = ?',
      [req.params.id, req.organizationId]
    );

    res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

module.exports = router;
