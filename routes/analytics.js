const express = require('express');
const db = require('../utils/database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get organization-wide analytics (admin/manager only)
router.get('/organization', authenticateToken, async (req, res) => {
  try {
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Total users
    const totalUsers = await db.get(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND is_active = 1',
      [req.organizationId]
    );

    // Total modules
    const totalModules = await db.get(
      'SELECT COUNT(*) as count FROM learning_modules WHERE organization_id = ? AND is_published = 1',
      [req.organizationId]
    );

    // Average completion rate
    const completionStats = await db.get(
      `SELECT 
        AVG(progress_percentage) as avg_progress,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as completion_rate
       FROM user_progress up
       INNER JOIN users u ON up.user_id = u.id
       WHERE u.organization_id = ?`,
      [req.organizationId]
    );

    // Average test scores
    const scoreStats = await db.get(
      `SELECT AVG(percentage) as avg_score
       FROM assessment_results ar
       INNER JOIN users u ON ar.user_id = u.id
       WHERE u.organization_id = ?`,
      [req.organizationId]
    );

    // Active learners (activity in last 7 days)
    const activeUsers = await db.get(
      `SELECT COUNT(DISTINCT user_id) as count
       FROM user_progress
       WHERE last_accessed >= datetime('now', '-7 days')
       AND user_id IN (SELECT id FROM users WHERE organization_id = ?)`,
      [req.organizationId]
    );

    // Top performers
    const topPerformers = await db.all(
      `SELECT u.id, u.full_name, u.username,
              up.total_points, up.level, up.current_streak_days,
              COUNT(DISTINCT prog.module_id) as modules_completed
       FROM users u
       INNER JOIN user_points up ON u.id = up.user_id
       LEFT JOIN user_progress prog ON u.id = prog.user_id AND prog.status = 'completed'
       WHERE u.organization_id = ? AND u.is_active = 1
       GROUP BY u.id
       ORDER BY up.total_points DESC
       LIMIT 10`,
      [req.organizationId]
    );

    res.json({
      totalUsers: totalUsers.count,
      totalModules: totalModules.count,
      averageProgress: completionStats.avg_progress || 0,
      completionRate: completionStats.completion_rate || 0,
      averageScore: scoreStats.avg_score || 0,
      activeUsers: activeUsers.count,
      topPerformers
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Get team/user list with progress
router.get('/users', authenticateToken, async (req, res) => {
  try {
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = await db.all(
      `SELECT 
        u.id, u.username, u.full_name, u.email, u.role, u.last_login,
        up.total_points, up.level, up.current_streak_days,
        COUNT(DISTINCT prog.module_id) as total_modules_started,
        COUNT(DISTINCT CASE WHEN prog.status = 'completed' THEN prog.module_id END) as completed_modules,
        AVG(CASE WHEN prog.status = 'completed' THEN 100 ELSE prog.progress_percentage END) as avg_progress
       FROM users u
       LEFT JOIN user_points up ON u.id = up.user_id
       LEFT JOIN user_progress prog ON u.id = prog.user_id
       WHERE u.organization_id = ? AND u.is_active = 1
       GROUP BY u.id
       ORDER BY up.total_points DESC`,
      [req.organizationId]
    );

    res.json(users);
  } catch (error) {
    console.error('Get users analytics error:', error);
    res.status(500).json({ error: 'Failed to get user analytics' });
  }
});

// Get module analytics
router.get('/modules/:moduleId', authenticateToken, async (req, res) => {
  try {
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { moduleId } = req.params;

    // Module completion stats
    const completionStats = await db.get(
      `SELECT 
        COUNT(*) as total_started,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        AVG(progress_percentage) as avg_progress,
        AVG(time_spent_minutes) as avg_time_spent
       FROM user_progress
       WHERE module_id = ?`,
      [moduleId]
    );

    // Assessment stats
    const assessmentStats = await db.get(
      `SELECT 
        COUNT(*) as total_attempts,
        AVG(percentage) as avg_score,
        COUNT(CASE WHEN passed = 1 THEN 1 END) * 100.0 / COUNT(*) as pass_rate
       FROM assessment_results
       WHERE module_id = ?`,
      [moduleId]
    );

    // Question performance
    const questionStats = await db.all(
      `SELECT 
        q.id, q.question_text, q.difficulty_level,
        COUNT(*) as times_answered,
        SUM(CASE WHEN json_extract(ar.answers, '$[*].questionId') = q.id 
                 AND json_extract(ar.answers, '$[*].isCorrect') = 1 
            THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as correct_rate
       FROM questions q
       LEFT JOIN assessment_results ar ON ar.module_id = ?
       WHERE q.module_id = ?
       GROUP BY q.id`,
      [moduleId, moduleId]
    );

    res.json({
      completion: completionStats,
      assessment: assessmentStats,
      questions: questionStats
    });
  } catch (error) {
    console.error('Module analytics error:', error);
    res.status(500).json({ error: 'Failed to get module analytics' });
  }
});

// Get leaderboard
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const { period = 'all' } = req.query;

    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "AND up.last_activity_date >= date('now', '-7 days')";
    } else if (period === 'month') {
      dateFilter = "AND up.last_activity_date >= date('now', '-30 days')";
    }

    const leaderboard = await db.all(
      `SELECT 
        u.id, u.username, u.full_name,
        up.total_points, up.level, up.current_streak_days,
        COUNT(DISTINCT prog.module_id) as modules_completed
       FROM users u
       INNER JOIN user_points up ON u.id = up.user_id
       LEFT JOIN user_progress prog ON u.id = prog.user_id AND prog.status = 'completed'
       WHERE u.organization_id = ? AND u.is_active = 1 ${dateFilter}
       GROUP BY u.id
       ORDER BY up.total_points DESC
       LIMIT 50`,
      [req.organizationId]
    );

    // Find current user's rank
    const userRank = leaderboard.findIndex(u => u.id === req.userId) + 1;

    res.json({
      leaderboard,
      currentUserRank: userRank || null
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

module.exports = router;
