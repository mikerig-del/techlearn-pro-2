# 🚀 TechLearn Pro - Quick Start Guide

## ✅ Platform is Now Running!

Your TechLearn Pro platform is **currently running** at:

**🌐 http://localhost:3000**

---

## 📝 Login Credentials

### Admin Account (Full Access)
- **Username:** `admin`
- **Password:** `admin123`
- **Capabilities:** Upload content, manage users, view analytics

### Learner Account (Student View)
- **Username:** `learner`
- **Password:** `learner123`
- **Capabilities:** Take courses, complete assessments, track progress

---

## 🎯 What Can You Do Right Now?

### As a Learner:
1. **Login** at http://localhost:3000
2. **Browse Modules** - See available training content
3. **Start Learning** - Click any module to begin
4. **Complete Assessments** - Answer quiz questions to earn points
5. **Track Progress** - View your dashboard, points, level, and streak

### As an Administrator:
1. **Login** with admin credentials
2. **Upload Content** - Go to "Content Library" tab
3. **Upload PDFs or Videos** - Drag and drop training materials
4. **AI Processing** - System automatically:
   - Extracts content from documents
   - Generates learning objectives
   - Creates quiz questions
   - Structures into modules
5. **Monitor Progress** - View "Analytics" tab for team insights

---

## 🔧 Server Management

### Check if Server is Running
```bash
cd /home/user/techlearn-platform
ps aux | grep "node server.js"
```

### View Server Logs
```bash
cd /home/user/techlearn-platform
tail -f server.log
```

### Stop Server
```bash
pkill -f "node server.js"
```

### Start Server
```bash
cd /home/user/techlearn-platform
nohup node server.js > server.log 2>&1 &
```

### Restart Server
```bash
cd /home/user/techlearn-platform
pkill -f "node server.js"
sleep 2
nohup node server.js > server.log 2>&1 &
```

---

## 🤖 Enable AI Features (Optional but Recommended)

To enable automatic content processing, question generation, and learning objectives:

1. **Get OpenAI API Key**
   - Visit: https://platform.openai.com/api-keys
   - Create a new API key
   - Copy the key (starts with `sk-...`)

2. **Add to Configuration**
   ```bash
   cd /home/user/techlearn-platform
   nano .env
   ```
   
   Update the line:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```
   
   Replace `your_openai_api_key_here` with your actual key

3. **Restart Server**
   ```bash
   pkill -f "node server.js"
   nohup node server.js > server.log 2>&1 &
   ```

**Without AI:** Platform works but you'll need to manually create quiz questions  
**With AI:** Automatic content transformation, quiz generation, learning objectives

---

## 📂 Project Structure

```
techlearn-platform/
├── server.js                 # Main server file
├── package.json             # Dependencies
├── .env                     # Configuration (API keys)
├── setup.js                 # Database initialization
├── data/                    # SQLite database
│   └── techlearn.db        # Main database file
├── uploads/                 # User-uploaded content
│   ├── documents/          # PDFs, Word files
│   ├── videos/             # MP4, MOV files
│   └── images/             # Images
├── routes/                  # API endpoints
│   ├── auth.js             # Login/registration
│   ├── content.js          # File uploads
│   ├── modules.js          # Learning modules
│   ├── learning.js         # Progress tracking
│   └── analytics.js        # Reports and stats
├── services/
│   └── contentProcessor.js # AI content processing
├── utils/
│   └── database.js         # Database wrapper
└── public/                  # Frontend files
    ├── index.html          # Main interface
    └── app.js              # Frontend JavaScript
```

---

## 🎓 Sample Workflow: Creating Your First Training Module

### Step 1: Login as Admin
1. Go to http://localhost:3000
2. Login with `admin` / `admin123`

### Step 2: Upload Training Material
1. Click **"Content Library"** tab
2. Click the upload area or drag-and-drop a PDF file
3. Wait for upload to complete (you'll see a confirmation)

### Step 3: AI Processing (Automatic)
- System extracts text from PDF
- Identifies key concepts and structure
- Generates learning objectives
- Creates quiz questions
- Builds learning module

### Step 4: View the Module
1. Switch to **"Learning Modules"** tab
2. You'll see your new module
3. Click it to preview

### Step 5: Test as Learner
1. Logout (click Logout button)
2. Login as `learner` / `learner123`
3. See the module on your dashboard
4. Click to start learning
5. Complete the assessment to earn points

---

## 📊 Key Features Explained

### 🎮 Gamification System
- **Points:** Earned by completing modules and assessments
- **Levels:** Automatically increase every 1000 points
- **Streaks:** Login and learn daily to maintain streak
- **Achievements:** Unlock badges for milestones (5, 10, 25+ modules)
- **Leaderboard:** Compete with other learners

### 📈 Progress Tracking
- **Module Progress:** Track completion percentage
- **Time Spent:** Monitor learning time per module
- **Assessment Results:** View scores and attempts
- **Completion Status:** not_started → in_progress → completed

### 🧠 AI Content Processing
- **Text Extraction:** Pull content from PDFs and documents
- **Structure Analysis:** Identify chapters, sections, key points
- **Learning Objectives:** Auto-generate 3-5 learning goals
- **Quiz Generation:** Create 5+ multiple-choice questions
- **Difficulty Calibration:** Questions marked as easy/medium/hard

### 📋 Assessment System
- **Multiple Choice:** 4 options per question
- **Scoring:** Points per correct answer
- **Passing Grade:** 70% required to complete module
- **Explanations:** Each question includes why answer is correct
- **Retakes:** Students can retake failed assessments

---

## 🔐 Security Notes

### Current Setup (Development)
- ✅ JWT authentication enabled
- ✅ Password hashing (bcrypt)
- ✅ SQL injection protection
- ⚠️ Default credentials (change for production)
- ⚠️ HTTP only (add HTTPS for production)

### For Production Use:
1. **Change Default Passwords**
   - Create new admin user with strong password
   - Delete or disable default accounts

2. **Update JWT Secret**
   ```bash
   nano .env
   # Change JWT_SECRET to a long random string
   ```

3. **Enable HTTPS**
   - Use reverse proxy (nginx, Apache)
   - Add SSL certificate
   - Redirect HTTP to HTTPS

4. **Database Migration**
   - Move from SQLite to PostgreSQL
   - Add database backups
   - Implement connection pooling

5. **File Upload Limits**
   - Review MAX_FILE_SIZE in .env
   - Add virus scanning for uploads
   - Validate file types

---

## 🐛 Troubleshooting

### Issue: Can't access http://localhost:3000

**Solution:**
```bash
# Check if server is running
cd /home/user/techlearn-platform
ps aux | grep "node server.js"

# If not running, start it
nohup node server.js > server.log 2>&1 &

# Check for errors
tail -f server.log
```

### Issue: Login fails with "Invalid credentials"

**Solution:**
```bash
# Reset database and recreate users
cd /home/user/techlearn-platform
rm data/techlearn.db
node setup.js
pkill -f "node server.js"
nohup node server.js > server.log 2>&1 &
```

### Issue: File upload fails

**Solution:**
```bash
# Check uploads directory exists and is writable
cd /home/user/techlearn-platform
ls -la uploads/
chmod -R 755 uploads/

# Check server logs
tail -f server.log
```

### Issue: AI processing not working

**Solution:**
1. Verify OpenAI API key is set in `.env`
2. Check API key is valid at https://platform.openai.com/api-keys
3. Ensure you have available credits in OpenAI account
4. Check server logs for API errors: `tail -f server.log`

### Issue: Port 3000 already in use

**Solution:**
```bash
# Change port in .env
nano .env
# Set: PORT=3001

# Restart server
pkill -f "node server.js"
nohup node server.js > server.log 2>&1 &

# Access at: http://localhost:3001
```

---

## 📧 API Testing with curl

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Get Dashboard Data
```bash
# First login and save token
TOKEN="your_jwt_token_here"

curl http://localhost:3000/api/learning/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

### Upload Content
```bash
curl -X POST http://localhost:3000/api/content/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/your/file.pdf" \
  -F "title=My Training Module"
```

---

## 🎉 Next Steps

### Short Term (Today):
- [ ] Login and explore the interface
- [ ] Upload a sample PDF training document
- [ ] Watch AI process the content
- [ ] Complete a module as a learner
- [ ] Check the analytics dashboard

### Medium Term (This Week):
- [ ] Add OpenAI API key for AI features
- [ ] Upload your actual training materials
- [ ] Create additional user accounts
- [ ] Customize branding in HTML/CSS
- [ ] Test on mobile devices

### Long Term (This Month):
- [ ] Plan production deployment
- [ ] Migrate to PostgreSQL database
- [ ] Set up HTTPS/SSL
- [ ] Implement backup strategy
- [ ] Train administrators and content creators

---

## 📚 Additional Resources

- **Full README:** `/home/user/techlearn-platform/README.md`
- **Environment Config:** `/home/user/techlearn-platform/.env`
- **Database Schema:** Review `setup.js` for table structures
- **API Documentation:** Check route files in `/routes/`

---

## ✨ Feature Highlights

### What Makes This Platform Special:

1. **AI-Powered Automation** 🤖
   - Upload any document → Get complete learning module
   - No manual quiz creation needed
   - Automatic learning objectives

2. **Engaging Experience** 🎮
   - Gamification keeps learners motivated
   - Real-time progress tracking
   - Social features (leaderboards, achievements)

3. **Comprehensive Analytics** 📊
   - Manager dashboard with insights
   - Track team performance
   - Identify struggling learners early

4. **Easy Content Management** 📁
   - Drag-and-drop file uploads
   - Support for PDFs, videos, documents
   - Automatic content organization

5. **Modern Technology** 💻
   - Responsive design (works on all devices)
   - Fast performance
   - RESTful API for integrations

---

## 🎊 Congratulations!

You now have a fully functional intelligent training platform! 

**Your platform is running at: http://localhost:3000**

Start by logging in and exploring. Happy learning! 🚀

---

*Built with Node.js, Express, SQLite, and OpenAI*
