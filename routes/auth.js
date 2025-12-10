const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../utils/database');
const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await db.get(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        role: user.role,
        organizationId: user.organization_id 
      },
      process.env.JWT_SECRET || 'default-secret-change-this',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        organizationId: user.organization_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, fullName, organizationId } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, username, and password required' });
    }

    // Check if user already exists
    const existing = await db.get(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    // Create user
    await db.run(
      `INSERT INTO users (id, email, username, password_hash, full_name, role, organization_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, username, passwordHash, fullName || username, 'learner', organizationId || 'org-demo']
    );

    // Initialize user points
    await db.run(
      'INSERT INTO user_points (user_id, total_points, level) VALUES (?, 0, 1)',
      [userId]
    );

    res.status(201).json({ 
      message: 'User created successfully',
      userId 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.get(
      `SELECT u.id, u.email, u.username, u.full_name, u.role, u.organization_id,
              up.total_points, up.level, up.current_streak_days
       FROM users u
       LEFT JOIN user_points up ON u.id = up.user_id
       WHERE u.id = ?`,
      [req.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default-secret-change-this', (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.organizationId = decoded.organizationId;
    next();
  });
}

module.exports = router;
module.exports.authenticateToken = authenticateToken;
