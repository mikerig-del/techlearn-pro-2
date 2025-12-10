const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get all learning modules
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { published } = req.query;
    
    let query = `
      SELECT m.*, c.title as content_title, c.file_url,
             (SELECT COUNT(*) FROM questions WHERE module_id = m.id) as question_count
      FROM learning_modules m
      LEFT JOIN content_items c ON m.content_item_id = c.id
      WHERE m.organization_id = ?
    `;
    const params = [req.organizationId];

    if (published !== undefined) {
      query += ' AND m.is_published = ?';
      params.push(published === 'true' ? 1 : 0);
    }

    query += ' ORDER BY m.sequence_order ASC, m.created_at DESC';

    const modules = await db.all(query, params);
    
    // Parse JSON fields
    modules.forEach(module => {
      if (module.learning_objectives) {
        try {
          module.learning_objectives = JSON.parse(module.learning_objectives);
        } catch (e) {
          module.learning_objectives = [];
        }
      }
    });

    res.json(modules);
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({ error: 'Failed to get modules' });
  }
});

// Get single module with questions
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const module = await db.get(
      `SELECT m.*, c.title as content_title, c.file_url, c.content_type, c.extracted_data
       FROM learning_modules m
       LEFT JOIN content_items c ON m.content_item_id = c.id
       WHERE m.id = ? AND m.organization_id = ?`,
      [req.params.id, req.organizationId]
    );

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // Parse JSON fields
    if (module.learning_objectives) {
      try {
        module.learning_objectives = JSON.parse(module.learning_objectives);
      } catch (e) {
        module.learning_objectives = [];
      }
    }

    if (module.extracted_data) {
      try {
        module.extracted_data = JSON.parse(module.extracted_data);
      } catch (e) {
        module.extracted_data = null;
      }
    }

    // Get questions for this module
    const questions = await db.all(
      'SELECT * FROM questions WHERE module_id = ? ORDER BY created_at',
      [req.params.id]
    );

    // Parse question options
    questions.forEach(q => {
      if (q.options) {
        try {
          q.options = JSON.parse(q.options);
        } catch (e) {
          q.options = [];
        }
      }
    });

    module.questions = questions;

    // Get user's progress for this module
    if (req.userId) {
      const progress = await db.get(
        'SELECT * FROM user_progress WHERE user_id = ? AND module_id = ?',
        [req.userId, req.params.id]
      );
      module.userProgress = progress;
    }

    res.json(module);
  } catch (error) {
    console.error('Get module error:', error);
    res.status(500).json({ error: 'Failed to get module' });
  }
});

// Create new module
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      contentItemId,
      learningObjectives,
      estimatedDuration,
      difficultyLevel,
      sequenceOrder
    } = req.body;

    const moduleId = 'module-' + uuidv4();

    await db.run(
      `INSERT INTO learning_modules 
       (id, title, description, content_item_id, learning_objectives, 
        estimated_duration_minutes, difficulty_level, sequence_order, organization_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        moduleId,
        title,
        description,
        contentItemId,
        JSON.stringify(learningObjectives || []),
        estimatedDuration || 30,
        difficultyLevel || 'beginner',
        sequenceOrder || 0,
        req.organizationId
      ]
    );

    res.status(201).json({
      message: 'Module created successfully',
      moduleId
    });
  } catch (error) {
    console.error('Create module error:', error);
    res.status(500).json({ error: 'Failed to create module' });
  }
});

// Update module
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      learningObjectives,
      estimatedDuration,
      difficultyLevel,
      isPublished
    } = req.body;

    await db.run(
      `UPDATE learning_modules 
       SET title = ?, description = ?, learning_objectives = ?,
           estimated_duration_minutes = ?, difficulty_level = ?, is_published = ?
       WHERE id = ? AND organization_id = ?`,
      [
        title,
        description,
        JSON.stringify(learningObjectives || []),
        estimatedDuration,
        difficultyLevel,
        isPublished ? 1 : 0,
        req.params.id,
        req.organizationId
      ]
    );

    res.json({ message: 'Module updated successfully' });
  } catch (error) {
    console.error('Update module error:', error);
    res.status(500).json({ error: 'Failed to update module' });
  }
});

// Delete module
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Delete associated questions
    await db.run('DELETE FROM questions WHERE module_id = ?', [req.params.id]);
    
    // Delete module
    await db.run(
      'DELETE FROM learning_modules WHERE id = ? AND organization_id = ?',
      [req.params.id, req.organizationId]
    );

    res.json({ message: 'Module deleted successfully' });
  } catch (error) {
    console.error('Delete module error:', error);
    res.status(500).json({ error: 'Failed to delete module' });
  }
});

// Publish/unpublish module
router.patch('/:id/publish', authenticateToken, async (req, res) => {
  try {
    const { isPublished } = req.body;

    await db.run(
      'UPDATE learning_modules SET is_published = ? WHERE id = ? AND organization_id = ?',
      [isPublished ? 1 : 0, req.params.id, req.organizationId]
    );

    res.json({ message: `Module ${isPublished ? 'published' : 'unpublished'} successfully` });
  } catch (error) {
    console.error('Publish module error:', error);
    res.status(500).json({ error: 'Failed to update module' });
  }
});

module.exports = router;
