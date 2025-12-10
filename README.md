# TechLearn Pro - Intelligent Adaptive Training Platform

A full-stack web application that transforms static training materials into dynamic, interactive learning experiences with AI-powered content processing.

## 🚀 Features

- **AI-Powered Content Processing**: Upload PDFs, videos, and documents - automatically extracts content, generates learning objectives, and creates quiz questions
- **Interactive Learning Modules**: Video playback, assessments, and progress tracking
- **Gamification**: Points, levels, streaks, achievements, and leaderboards
- **Progress Tracking**: Real-time monitoring of learner progress and performance
- **Analytics Dashboard**: Comprehensive insights for managers and administrators
- **Multi-Tenant Support**: Organization-based content and user management

## 📋 Prerequisites

- Node.js 16+ 
- npm or yarn
- OpenAI API key (for AI features)

## 🔧 Installation

### 1. Clone and Install Dependencies

```bash
cd techlearn-platform
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
nano .env
```

Required environment variables:
```
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
JWT_SECRET=change_this_to_random_string
```

### 3. Initialize Database

```bash
npm run setup
```

This will:
- Create necessary directories
- Initialize SQLite database
- Create database schema
- Create demo users:
  - **Admin**: username: `admin`, password: `admin123`
  - **Learner**: username: `learner`, password: `learner123`

### 4. Start the Server

```bash
npm start
```

The application will be available at: **http://localhost:3000**

## 🎯 Quick Start Guide

### For Learners

1. **Login** with learner credentials (learner / learner123)
2. **Browse Modules** on the dashboard
3. **Start Learning** by clicking on any module
4. **Complete Assessments** to earn points and badges
5. **Track Progress** on your dashboard

### For Administrators

1. **Login** with admin credentials (admin / admin123)
2. **Upload Content** via the Content Library tab
3. **AI Processing** automatically creates modules and quizzes
4. **Monitor Progress** via Analytics dashboard
5. **Manage Users** and view performance metrics

## 📚 How It Works

### Content Upload Flow

1. **Upload** - Admin uploads PDF/video/document
2. **Processing** - AI extracts text, identifies structure, analyzes content
3. **Module Creation** - System automatically creates learning module
4. **Question Generation** - AI generates quiz questions from content
5. **Publishing** - Module becomes available to learners

### Learning Flow

1. **Start Module** - Learner begins a learning module
2. **Content Consumption** - Video/document review with interactive elements
3. **Knowledge Check** - Complete assessment questions
4. **Completion** - Earn points, badges, and unlock new content
5. **Progress Tracking** - System tracks time spent, scores, completion status

## 🏗️ Architecture

### Backend
- **Framework**: Node.js + Express
- **Database**: SQLite (production would use PostgreSQL)
- **AI**: OpenAI GPT-3.5/4 for content processing
- **Authentication**: JWT-based authentication
- **File Processing**: PDF parsing, video handling

### Frontend
- **Vanilla JavaScript** with modern ES6+
- **Responsive Design** - works on desktop, tablet, mobile
- **Real-time Updates** via REST API
- **Modal-based UI** for immersive learning experience

### Database Schema

Key tables:
- `users` - User accounts and authentication
- `organizations` - Multi-tenant organization data
- `content_items` - Uploaded files and extracted data
- `learning_modules` - Structured learning content
- `questions` - Assessment questions
- `user_progress` - Learning progress tracking
- `assessment_results` - Quiz scores and attempts
- `user_achievements` - Badges and milestones
- `user_points` - Gamification tracking

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

### Content Management
- `POST /api/content/upload` - Upload training material
- `GET /api/content` - List all content
- `GET /api/content/:id` - Get specific content
- `DELETE /api/content/:id` - Delete content

### Learning Modules
- `GET /api/modules` - List all modules
- `GET /api/modules/:id` - Get module details
- `POST /api/modules` - Create new module
- `PUT /api/modules/:id` - Update module

### Learning & Progress
- `GET /api/learning/dashboard` - User dashboard data
- `POST /api/learning/modules/:id/start` - Start a module
- `PUT /api/learning/progress/:id` - Update progress
- `POST /api/learning/modules/:id/assessment` - Submit assessment

### Analytics
- `GET /api/analytics/organization` - Organization stats
- `GET /api/analytics/users` - User performance data
- `GET /api/analytics/leaderboard` - Points leaderboard

## 🎨 Customization

### Branding
Edit `/public/index.html` and `/public/app.js` to customize:
- Colors and theme
- Logo and branding
- UI text and labels

### AI Processing
Edit `/services/contentProcessor.js` to adjust:
- Question generation prompts
- Learning objective extraction
- Content structuring logic

### Gamification
Edit `/routes/learning.js` to modify:
- Points awarded per action
- Level thresholds
- Achievement triggers

## 🔒 Security Notes

⚠️ **Important for Production:**

1. **Change JWT Secret**: Update `JWT_SECRET` in `.env` to a strong random string
2. **Use HTTPS**: Deploy behind HTTPS/SSL
3. **Database**: Migrate to PostgreSQL for production
4. **File Upload Limits**: Review and adjust `MAX_FILE_SIZE`
5. **API Rate Limiting**: Implement rate limiting middleware
6. **Input Validation**: Add comprehensive input validation
7. **CORS Configuration**: Restrict CORS to your domain

## 📊 Future Enhancements

Potential additions:
- Video transcription using Whisper API
- Advanced spaced repetition algorithms
- Mobile native apps (React Native)
- Real-time collaboration features
- AR/VR integration for technical training
- Advanced analytics with ML insights
- Integration with external LMS platforms
- Multi-language support

## 🐛 Troubleshooting

### Database Issues
```bash
# Reset database
rm data/techlearn.db
npm run setup
```

### Port Already in Use
```bash
# Change port in .env
PORT=3001
```

### Upload Failures
- Check file size limits in `.env`
- Ensure `uploads/` directory exists and is writable
- Verify OpenAI API key is valid

### AI Processing Not Working
- Verify `OPENAI_API_KEY` is set in `.env`
- Check OpenAI account has available credits
- Review console logs for API errors

## 📝 License

This project is provided as-is for demonstration and educational purposes.

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Review console logs for errors
3. Ensure all environment variables are set correctly

## 🚀 Deployment

### Quick Deploy (Local Network)

```bash
# Install and start
npm install
npm run setup
npm start
```

Access from other devices on your network:
- Find your local IP: `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
- Access at: `http://YOUR_IP:3000`

### Production Deploy

For production deployment:
1. Use PostgreSQL instead of SQLite
2. Set up proper HTTPS/SSL
3. Use environment-based configuration
4. Implement proper logging and monitoring
5. Set up automated backups
6. Use a process manager (PM2)

---

Built with ❤️ for transforming technical training
