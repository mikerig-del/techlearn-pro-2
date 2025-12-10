const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get user's learning dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get user's progress summary
    const progressSummary = await db.get(
      `SELECT 
        COUNT(*) as total_modules,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_modules,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_modules,
        SUM(time_spent_minutes) as total_time_spent
       FROM user_progress
       WHERE user_id = ?`,
      [req.userId]
    );

    // Get user points and achievements
    const userStats = await db.get(
      `SELECT total_points, current_streak_days, longest_streak_days, level
       FROM user_points
       WHERE user_id = ?`,
      [req.userId]
    );

    // Get in-progress modules
    const inProgressModules = await db.all(
      `SELECT m.*, up.progress_percentage, up.last_accessed, up.time_spent_minutes
       FROM learning_modules m
       INNER JOIN user_progress up ON m.id = up.module_id
       WHERE up.user_id = ? AND up.status = 'in_progress'
       ORDER BY up.last_accessed DESC
       LIMIT 5`,
      [req.userId]
    );

    // Get recommended modules (not started, published)
    const recommendedModules = await db.all(
      `SELECT m.*, c.file_url
       FROM learning_modules m
       LEFT JOIN content_items c ON m.content_item_id = c.id
       LEFT JOIN user_progress up ON m.id = up.module_id AND up.user_id = ?
       WHERE m.is_published = 1 
       AND m.organization_id = ?
       AND (up.id IS NULL OR up.status = 'not_started')
       ORDER BY m.sequence_order ASC
       LIMIT 6`,
      [req.userId, req.organizationId]
    );

    // Get recent achievements
    const recentAchievements = await db.all(
      `SELECT * FROM user_achievements
       WHERE user_id = ?
       ORDER BY earned_at DESC
       LIMIT 5`,
      [req.userId]
    );

    res.json({
      summary: progressSummary,
      stats: userStats || { total_points: 0, current_streak_days: 0, level: 1 },
      inProgress: inProgressModules,
      recommended: recommendedModules,
      recentAchievements
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// Start a module
router.post('/modules/:moduleId/start', authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const progressId = 'progress-' + uuidv4();

    // Check if progress already exists
    const existing = await db.get(
      'SELECT id, status FROM user_progress WHERE user_id = ? AND module_id = ?',
      [req.userId, moduleId]
    );

    if (existing) {
      if (existing.status === 'completed') {
        return res.json({ message: 'Module already completed', progressId: existing.id });
      }
      
      // Update last accessed
      await db.run(
        'UPDATE user_progress SET last_accessed = CURRENT_TIMESTAMP, status = ? WHERE id = ?',
        ['in_progress', existing.id]
      );
      
      return res.json({ message: 'Module resumed', progressId: existing.id });
    }

    // Create new progress record
    await db.run(
      `INSERT INTO user_progress 
       (id, user_id, module_id, status, progress_percentage, started_at, last_accessed)
       VALUES (?, ?, ?, 'in_progress', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [progressId, req.userId, moduleId]
    );

    // Update user activity streak
    await updateUserStreak(req.userId);

    res.json({ message: 'Module started', progressId });
  } catch (error) {
    console.error('Start module error:', error);
    res.status(500).json({ error: 'Failed to start module' });
  }
});

// Update progress
router.put('/progress/:progressId', authenticateToken, async (req, res) => {
  try {
    const { progressPercentage, timeSpentMinutes } = req.body;

    await db.run(
      `UPDATE user_progress 
       SET progress_percentage = ?, 
           time_spent_minutes = time_spent_minutes + ?,
           last_accessed = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [progressPercentage, timeSpentMinutes || 0, req.params.progressId, req.userId]
    );

    // Update streak
    await updateUserStreak(req.userId);

    res.json({ message: 'Progress updated' });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Submit assessment
router.post('/modules/:moduleId/assessment', authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { answers } = req.body;

    // Get module questions
    const questions = await db.all(
      'SELECT * FROM questions WHERE module_id = ?',
      [moduleId]
    );

    if (questions.length === 0) {
      return res.status(400).json({ error: 'No questions found for this module' });
    }

    // Calculate score
    let correctAnswers = 0;
    let totalPoints = 0;
    const detailedResults = [];

    questions.forEach(question => {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correct_answer;
      
      if (isCorrect) {
        correctAnswers += question.points;
      }

      detailedResults.push({
        questionId: question.id,
        userAnswer,
        correctAnswer: question.correct_answer,
        isCorrect,
        explanation: question.explanation
      });
    });

    const percentage = (correctAnswers / totalPoints) * 100;
    const passed = percentage >= 70; // 70% passing grade

    // Get attempt number
    const previousAttempts = await db.all(
      'SELECT attempt_number FROM assessment_results WHERE user_id = ? AND module_id = ? ORDER BY attempt_number DESC LIMIT 1',
      [req.userId, moduleId]
    );
    const attemptNumber = previousAttempts.length > 0 ? previousAttempts[0].attempt_number + 1 : 1;

    // Save assessment result
    const resultId = 'result-' + uuidv4();
    await db.run(
      `INSERT INTO assessment_results 
       (id, user_id, module_id, score, max_score, percentage, answers, passed, attempt_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultId,
        req.userId,
        moduleId,
        correctAnswers,
        totalPoints,
        percentage,
        JSON.stringify(detailedResults),
        passed ? 1 : 0,
        attemptNumber
      ]
    );

    // If passed, update module progress to completed
    if (passed) {
      await db.run(
        `UPDATE user_progress 
         SET status = 'completed', progress_percentage = 100, completed_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND module_id = ?`,
        [req.userId, moduleId]
      );

      // Award points
      const pointsEarned = Math.round(percentage); // 1 point per percentage
      await awardPoints(req.userId, pointsEarned, 'module_completion', moduleId);

      // Check for achievements
      await checkAchievements(req.userId);
    }

    res.json({
      resultId,
      score: correctAnswers,
      maxScore: totalPoints,
      percentage: percentage.toFixed(2),
      passed,
      attemptNumber,
      results: detailedResults
    });
  } catch (error) {
    console.error('Submit assessment error:', error);
    res.status(500).json({ error: 'Failed to submit assessment' });
  }
});

// Get user's assessment history
router.get('/modules/:moduleId/assessments', authenticateToken, async (req, res) => {
  try {
    const results = await db.all(
      `SELECT * FROM assessment_results
       WHERE user_id = ? AND module_id = ?
       ORDER BY taken_at DESC`,
      [req.userId, req.params.moduleId]
    );

    results.forEach(result => {
      if (result.answers) {
        try {
          result.answers = JSON.parse(result.answers);
        } catch (e) {
          result.answers = [];
        }
      }
    });

    res.json(results);
  } catch (error) {
    console.error('Get assessments error:', error);
    res.status(500).json({ error: 'Failed to get assessment history' });
  }
});

// Helper functions
async function updateUserStreak(userId) {
  try {
    const userPoints = await db.get(
      'SELECT last_activity_date, current_streak_days, longest_streak_days FROM user_points WHERE user_id = ?',
      [userId]
    );

    if (!userPoints) {
      await db.run(
        'INSERT INTO user_points (user_id, last_activity_date, current_streak_days) VALUES (?, DATE("now"), 1)',
        [userId]
      );
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const lastActivity = userPoints.last_activity_date;

    if (lastActivity !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak = 1;
      if (lastActivity === yesterdayStr) {
        // Consecutive day
        newStreak = (userPoints.current_streak_days || 0) + 1;
      }

      const longestStreak = Math.max(newStreak, userPoints.longest_streak_days || 0);

      await db.run(
        `UPDATE user_points 
         SET last_activity_date = ?, current_streak_days = ?, longest_streak_days = ?
         WHERE user_id = ?`,
        [today, newStreak, longestStreak, userId]
      );
    }
  } catch (error) {
    console.error('Update streak error:', error);
  }
}

async function awardPoints(userId, points, achievementType, referenceId) {
  try {
    // Add to total points
    await db.run(
      'UPDATE user_points SET total_points = total_points + ? WHERE user_id = ?',
      [points, userId]
    );

    // Create achievement record
    const achievementId = 'achievement-' + uuidv4();
    await db.run(
      'INSERT INTO user_achievements (id, user_id, achievement_type, achievement_name, points_awarded) VALUES (?, ?, ?, ?, ?)',
      [achievementId, userId, achievementType, `Earned ${points} points`, points]
    );

    // Update level if needed
    const userPoints = await db.get('SELECT total_points FROM user_points WHERE user_id = ?', [userId]);
    const level = Math.floor(userPoints.total_points / 1000) + 1; // Level up every 1000 points
    await db.run('UPDATE user_points SET level = ? WHERE user_id = ?', [level, userId]);
  } catch (error) {
    console.error('Award points error:', error);
  }
}

async function checkAchievements(userId) {
  try {
    // Check for completion milestones
    const completedCount = await db.get(
      'SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND status = "completed"',
      [userId]
    );

    const milestones = [5, 10, 25, 50, 100];
    for (const milestone of milestones) {
      if (completedCount.count === milestone) {
        const achievementId = 'achievement-' + uuidv4();
        await db.run(
          'INSERT INTO user_achievements (id, user_id, achievement_type, achievement_name, points_awarded) VALUES (?, ?, ?, ?, ?)',
          [achievementId, userId, 'milestone', `Completed ${milestone} modules!`, milestone * 10]
        );
        await db.run(
          'UPDATE user_points SET total_points = total_points + ? WHERE user_id = ?',
          [milestone * 10, userId]
        );
      }
    }
  } catch (error) {
    console.error('Check achievements error:', error);
  }
}

module.exports = router;
