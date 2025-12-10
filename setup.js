const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Create necessary directories
const dirs = ['./data', './uploads', './uploads/videos', './uploads/documents', './uploads/images'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
});

// Initialize database
const db = new sqlite3.Database('./data/techlearn.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('✓ Connected to SQLite database');
});

// Create tables
const schema = `
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'learner',
    organization_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active INTEGER DEFAULT 1
  );

  -- Organizations table
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    settings TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Content items table
  CREATE TABLE IF NOT EXISTS content_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT,
    file_path TEXT,
    file_url TEXT,
    extracted_data TEXT,
    status TEXT DEFAULT 'processing',
    created_by TEXT,
    organization_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  -- Learning modules table
  CREATE TABLE IF NOT EXISTS learning_modules (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content_item_id TEXT,
    learning_objectives TEXT,
    estimated_duration_minutes INTEGER,
    difficulty_level TEXT,
    sequence_order INTEGER,
    organization_id TEXT,
    is_published INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_item_id) REFERENCES content_items(id)
  );

  -- Questions table
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    module_id TEXT,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'multiple_choice',
    options TEXT,
    correct_answer TEXT,
    explanation TEXT,
    difficulty_level TEXT,
    points INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (module_id) REFERENCES learning_modules(id)
  );

  -- User progress table
  CREATE TABLE IF NOT EXISTS user_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    module_id TEXT,
    status TEXT DEFAULT 'not_started',
    progress_percentage REAL DEFAULT 0,
    time_spent_minutes INTEGER DEFAULT 0,
    started_at DATETIME,
    completed_at DATETIME,
    last_accessed DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (module_id) REFERENCES learning_modules(id),
    UNIQUE(user_id, module_id)
  );

  -- Assessment results table
  CREATE TABLE IF NOT EXISTS assessment_results (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    module_id TEXT,
    score REAL,
    max_score REAL,
    percentage REAL,
    answers TEXT,
    passed INTEGER,
    attempt_number INTEGER DEFAULT 1,
    taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (module_id) REFERENCES learning_modules(id)
  );

  -- User achievements table
  CREATE TABLE IF NOT EXISTS user_achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    achievement_type TEXT,
    achievement_name TEXT,
    points_awarded INTEGER DEFAULT 0,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- User points table
  CREATE TABLE IF NOT EXISTS user_points (
    user_id TEXT PRIMARY KEY,
    total_points INTEGER DEFAULT 0,
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    last_activity_date DATE,
    level INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_content_status ON content_items(status);
  CREATE INDEX IF NOT EXISTS idx_user_progress ON user_progress(user_id, module_id);
  CREATE INDEX IF NOT EXISTS idx_modules_org ON learning_modules(organization_id);
`;

db.exec(schema, async (err) => {
  if (err) {
    console.error('Error creating schema:', err);
    process.exit(1);
  }
  console.log('✓ Database schema created');

  // Create default organization
  const orgId = 'org-' + Date.now();
  db.run(
    'INSERT OR IGNORE INTO organizations (id, name, subdomain) VALUES (?, ?, ?)',
    [orgId, 'Demo Organization', 'demo'],
    (err) => {
      if (err) console.error('Error creating organization:', err);
      else console.log('✓ Created default organization');
    }
  );

  // Create demo admin user
  const adminId = 'user-admin-' + Date.now();
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  db.run(
    'INSERT OR IGNORE INTO users (id, email, username, password_hash, full_name, role, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [adminId, 'admin@techlearn.local', 'admin', passwordHash, 'Admin User', 'admin', orgId],
    (err) => {
      if (err) console.error('Error creating admin user:', err);
      else console.log('✓ Created admin user (username: admin, password: admin123)');
    }
  );

  // Create demo learner user
  const learnerId = 'user-learner-' + Date.now();
  const learnerPasswordHash = await bcrypt.hash('learner123', 10);
  
  db.run(
    'INSERT OR IGNORE INTO users (id, email, username, password_hash, full_name, role, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [learnerId, 'learner@techlearn.local', 'learner', learnerPasswordHash, 'John Technician', 'learner', orgId],
    (err) => {
      if (err) console.error('Error creating learner user:', err);
      else {
        console.log('✓ Created learner user (username: learner, password: learner123)');
        
        // Initialize points for learner
        db.run(
          'INSERT OR IGNORE INTO user_points (user_id, total_points, level) VALUES (?, ?, ?)',
          [learnerId, 0, 1],
          (err) => {
            if (err) console.error('Error initializing points:', err);
          }
        );
      }
      
      console.log('\n=================================');
      console.log('✓ Setup completed successfully!');
      console.log('=================================\n');
      console.log('Next steps:');
      console.log('1. Copy .env.example to .env');
      console.log('2. Add your OpenAI API key to .env');
      console.log('3. Run: npm install');
      console.log('4. Run: npm start');
      console.log('5. Open http://localhost:3000 in your browser\n');
      
      db.close();
    }
  );
});
