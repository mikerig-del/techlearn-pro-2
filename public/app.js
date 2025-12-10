// API Base URL
const API_BASE = '/api';

// Global state
let currentUser = null;
let authToken = null;
let currentModule = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Check for existing session
  authToken = localStorage.getItem('authToken');
  if (authToken) {
    loadCurrentUser();
  }

  // Setup login form
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

// Authentication
async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      showApp();
    } else {
      showError(data.error || 'Login failed');
    }
  } catch (error) {
    showError('Connection error. Please try again.');
  }
}

function showError(message) {
  const errorDiv = document.getElementById('loginError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  authToken = null;
  currentUser = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
}

async function loadCurrentUser() {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      const user = await response.json();
      currentUser = user;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      showApp();
    } else {
      logout();
    }
  } catch (error) {
    console.error('Failed to load user:', error);
    logout();
  }
}

function showApp() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  
  // Update user info
  document.getElementById('userName').textContent = currentUser.full_name || currentUser.username;
  
  // Show/hide tabs based on role
  if (currentUser.role === 'admin' || currentUser.role === 'manager') {
    document.getElementById('contentTab').style.display = 'block';
    document.getElementById('analyticsTab').style.display = 'block';
  }
  
  // Load dashboard
  loadDashboard();
}

// Dashboard
async function loadDashboard() {
  try {
    const response = await fetch(`${API_BASE}/learning/dashboard`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to load dashboard');
    
    const data = await response.json();
    
    // Update stats
    document.getElementById('totalPoints').textContent = data.stats.total_points || 0;
    document.getElementById('completedModules').textContent = data.summary.completed_modules || 0;
    document.getElementById('currentStreak').textContent = `${data.stats.current_streak_days || 0} 🔥`;
    document.getElementById('userLevel').textContent = data.stats.level || 1;
    document.getElementById('userPoints').textContent = `${data.stats.total_points || 0} pts`;
    
    // Render in-progress modules
    const inProgressDiv = document.getElementById('inProgressModules');
    if (data.inProgress && data.inProgress.length > 0) {
      inProgressDiv.innerHTML = data.inProgress.map(module => renderModuleCard(module, true)).join('');
    } else {
      inProgressDiv.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📚</div><p>No modules in progress. Start learning below!</p></div>';
    }
    
    // Render recommended modules
    const recommendedDiv = document.getElementById('recommendedModules');
    if (data.recommended && data.recommended.length > 0) {
      recommendedDiv.innerHTML = data.recommended.map(module => renderModuleCard(module, false)).join('');
    } else {
      recommendedDiv.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✨</div><p>No new modules available</p></div>';
    }
  } catch (error) {
    console.error('Dashboard error:', error);
  }
}

function renderModuleCard(module, showProgress = false) {
  const progress = showProgress ? module.progress_percentage || 0 : 0;
  const difficultyClass = module.difficulty_level || 'beginner';
  
  return `
    <div class="module-card" onclick="openModule('${module.id}')">
      <h3>${module.title}</h3>
      <p>${module.description || 'Click to start learning'}</p>
      ${showProgress ? `
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <p style="font-size: 12px; color: #888;">${Math.round(progress)}% complete</p>
      ` : ''}
      <div class="module-meta">
        <span class="badge ${difficultyClass}">${module.difficulty_level || 'Beginner'}</span>
        <span>⏱️ ${module.estimated_duration_minutes || 30} min</span>
      </div>
    </div>
  `;
}

// Modules
async function loadAllModules() {
  try {
    const response = await fetch(`${API_BASE}/modules?published=true`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to load modules');
    
    const modules = await response.json();
    const modulesDiv = document.getElementById('allModules');
    
    // Add upload button for admins
    let headerHtml = '';
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager')) {
      headerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0;">All Learning Modules</h2>
          <button class="btn btn-primary" onclick="showUploadModal()" style="width: auto; padding: 10px 20px;">📤 Upload New Content</button>
        </div>
      `;
    }
    
    if (modules.length > 0) {
      modulesDiv.innerHTML = headerHtml + modules.map(module => renderModuleCard(module, false)).join('');
    } else {
      modulesDiv.innerHTML = headerHtml + '<div class="empty-state"><div class="empty-state-icon">📚</div><p>No modules available yet</p></div>';
    }
  } catch (error) {
    console.error('Load modules error:', error);
  }
}

async function openModule(moduleId) {
  try {
    const response = await fetch(`${API_BASE}/modules/${moduleId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to load module');
    
    currentModule = await response.json();
    
    // Start the module if not already started
    if (!currentModule.userProgress || currentModule.userProgress.status === 'not_started') {
      await fetch(`${API_BASE}/learning/modules/${moduleId}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
    }
    
    renderModuleViewer(currentModule);
    document.getElementById('moduleModal').style.display = 'block';
  } catch (error) {
    console.error('Open module error:', error);
    alert('Failed to load module');
  }
}

function renderModuleViewer(module) {
  const contentDiv = document.getElementById('moduleContent');
  
  let contentHtml = `
    <h1>${module.title}</h1>
    <p style="color: #666; margin-bottom: 20px;">${module.description || ''}</p>
    
    <div style="margin-bottom: 30px;">
      <h3>Learning Objectives:</h3>
      <ul style="margin-left: 20px; line-height: 1.8;">
        ${(module.learning_objectives || []).map(obj => `<li>${obj}</li>`).join('')}
      </ul>
    </div>
  `;
  
  // Show content based on type
  if (module.content_type === 'video' && module.file_url) {
    contentHtml += `
      <video class="video-player" controls>
        <source src="${module.file_url}" type="video/mp4">
        Your browser does not support video playback.
      </video>
    `;
  } else if (module.content_type === 'application' && module.file_url) {
    contentHtml += `
      <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p>📄 Document available for review</p>
        <a href="${module.file_url}" target="_blank" class="btn btn-primary" style="display: inline-block; margin-top: 10px;">Open Document</a>
      </div>
    `;
  }
  
  // Show extracted content if available
  if (module.extracted_data && module.extracted_data.sections) {
    contentHtml += `<div style="margin: 30px 0;">`;
    module.extracted_data.sections.slice(0, 3).forEach(section => {
      contentHtml += `
        <div style="margin-bottom: 20px;">
          <h3>${section.title}</h3>
          <p style="color: #666; line-height: 1.6;">${section.content.slice(0, 3).join(' ')}</p>
        </div>
      `;
    });
    contentHtml += `</div>`;
  }
  
  // Show questions/assessment
  if (module.questions && module.questions.length > 0) {
    contentHtml += `
      <div style="margin-top: 40px;">
        <h2>Knowledge Check</h2>
        <p style="color: #666; margin-bottom: 20px;">Complete this assessment to finish the module</p>
        ${renderQuestions(module.questions)}
        <button class="btn" onclick="submitAssessment()">Submit Assessment</button>
      </div>
    `;
  } else {
    contentHtml += `
      <div style="margin-top: 40px; text-align: center;">
        <p style="color: #888; margin-bottom: 20px;">Module completed! No assessment required.</p>
        <button class="btn" onclick="markComplete()">Mark as Complete</button>
      </div>
    `;
  }
  
  contentDiv.innerHTML = contentHtml;
}

function renderQuestions(questions) {
  return questions.map((q, index) => `
    <div class="question-card" id="question-${q.id}">
      <h4>Question ${index + 1}</h4>
      <p style="margin: 15px 0; font-size: 16px;">${q.question_text}</p>
      <div class="options">
        ${q.options.map(option => `
          <div class="option" onclick="selectOption('${q.id}', '${option.charAt(0)}')">
            ${option}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function selectOption(questionId, answer) {
  // Remove previous selection
  const questionCard = document.getElementById(`question-${questionId}`);
  questionCard.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
  
  // Mark selected
  event.target.classList.add('selected');
  
  // Store answer
  if (!window.assessmentAnswers) window.assessmentAnswers = {};
  window.assessmentAnswers[questionId] = answer;
}

async function submitAssessment() {
  if (!window.assessmentAnswers || Object.keys(window.assessmentAnswers).length === 0) {
    alert('Please answer at least one question');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/learning/modules/${currentModule.id}/assessment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ answers: window.assessmentAnswers })
    });
    
    if (!response.ok) throw new Error('Failed to submit assessment');
    
    const result = await response.json();
    
    // Show results
    alert(`Assessment Complete!\n\nScore: ${result.score}/${result.maxScore} (${result.percentage}%)\nStatus: ${result.passed ? 'PASSED ✅' : 'Not Passed ❌'}\n\n${result.passed ? 'Congratulations! You\'ve completed this module.' : 'Please review the material and try again.'}`);
    
    if (result.passed) {
      closeModal();
      loadDashboard();
    } else {
      // Show correct answers
      result.results.forEach(r => {
        const questionCard = document.getElementById(`question-${r.questionId}`);
        if (questionCard) {
          questionCard.classList.add(r.isCorrect ? 'correct' : 'incorrect');
          questionCard.innerHTML += `<p style="margin-top: 15px; padding: 10px; background: white; border-radius: 6px;"><strong>Explanation:</strong> ${r.explanation}</p>`;
        }
      });
    }
    
    window.assessmentAnswers = {};
  } catch (error) {
    console.error('Submit assessment error:', error);
    alert('Failed to submit assessment');
  }
}

async function markComplete() {
  try {
    // Just close and refresh
    closeModal();
    loadDashboard();
  } catch (error) {
    console.error('Error:', error);
  }
}

function closeModal() {
  document.getElementById('moduleModal').style.display = 'none';
  currentModule = null;
  window.assessmentAnswers = {};
}

// Content Management
async function uploadFile() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  
  if (!file) return;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', file.name);
  formData.append('description', `Uploaded: ${file.name}`);
  
  try {
    const response = await fetch(`${API_BASE}/content/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData
    });
    
    if (!response.ok) throw new Error('Upload failed');
    
    const result = await response.json();
    alert('File uploaded successfully! AI processing started...');
    
    // Reload content list
    setTimeout(() => loadContentList(), 2000);
    
    // Clear input
    fileInput.value = '';
  } catch (error) {
    console.error('Upload error:', error);
    alert('Upload failed: ' + error.message);
  }
}

async function loadContentList() {
  try {
    const response = await fetch(`${API_BASE}/content`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to load content');
    
    const items = await response.json();
    const listDiv = document.getElementById('contentList');
    
    if (items.length > 0) {
      listDiv.innerHTML = items.map(item => `
        <li class="content-item">
          <div>
            <strong>${item.title}</strong>
            <br>
            <span style="font-size: 12px; color: #888;">
              ${item.content_type} • ${item.status} • ${new Date(item.created_at).toLocaleDateString()}
            </span>
          </div>
          <div>
            ${item.status === 'ready' ? `<button class="btn-small btn-success" onclick="alert('Module auto-created!')">View Module</button>` : `<span class="badge">${item.status}</span>`}
          </div>
        </li>
      `).join('');
    } else {
      listDiv.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📁</div><p>No content uploaded yet</p></div>';
    }
  } catch (error) {
    console.error('Load content error:', error);
  }
}

// Analytics
async function loadAnalytics() {
  try {
    const response = await fetch(`${API_BASE}/analytics/organization`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to load analytics');
    
    const data = await response.json();
    const analyticsDiv = document.getElementById('analyticsData');
    
    analyticsDiv.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Users</h3>
          <div class="stat-value">${data.totalUsers}</div>
        </div>
        <div class="stat-card">
          <h3>Active Users (7d)</h3>
          <div class="stat-value">${data.activeUsers}</div>
        </div>
        <div class="stat-card">
          <h3>Completion Rate</h3>
          <div class="stat-value">${Math.round(data.completionRate)}%</div>
        </div>
        <div class="stat-card">
          <h3>Average Score</h3>
          <div class="stat-value">${Math.round(data.averageScore)}%</div>
        </div>
      </div>
      
      <h3 style="margin-top: 40px; margin-bottom: 20px;">Top Performers</h3>
      <div style="background: #f9f9f9; border-radius: 10px; padding: 20px;">
        ${data.topPerformers.map((user, index) => `
          <div style="display: flex; justify-content: space-between; padding: 15px; border-bottom: 1px solid #e0e0e0;">
            <div>
              <strong>#${index + 1} ${user.full_name}</strong>
              <br>
              <span style="font-size: 13px; color: #888;">Level ${user.level} • ${user.modules_completed} modules</span>
            </div>
            <div style="text-align: right;">
              <strong style="color: #667eea;">${user.total_points} pts</strong>
              <br>
              <span style="font-size: 13px; color: #888;">${user.current_streak_days} day streak 🔥</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Analytics error:', error);
    document.getElementById('analyticsData').innerHTML = '<p style="color: #f44336;">Failed to load analytics</p>';
  }
}

// Tab Navigation
function showTab(tabName) {
  // Update active tab
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');
  
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
  
  // Show selected tab
  const tabContent = document.getElementById(tabName + 'Tab');
  if (tabContent) {
    tabContent.classList.remove('hidden');
    
    // Load data based on tab
    if (tabName === 'dashboard') {
      loadDashboard();
    } else if (tabName === 'modules') {
      loadAllModules();
    } else if (tabName === 'content') {
      loadContentList();
    } else if (tabName === 'analytics') {
      loadAnalytics();
    }
  }
}

// Content Upload Functions
function showUploadModal() {
  document.getElementById('uploadModal').style.display = 'block';
}

function closeUploadModal() {
  document.getElementById('uploadModal').style.display = 'none';
  document.getElementById('uploadForm').reset();
}

async function handleContentUpload(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  const uploadBtn = form.querySelector('button[type="submit"]');
  const originalText = uploadBtn.textContent;
  
  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading... ⏳';
    
    const response = await fetch(`${API_BASE}/content/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    
    const result = await response.json();
    
    // Show simple success message (doesn't depend on response structure)
    alert('✅ Content uploaded successfully!\n\nYour training module has been created and is now available in Learning Modules!');
    
    // Close modal and reload modules
    closeUploadModal();
    loadAllModules();
    
  } catch (error) {
    console.error('Upload error:', error);
    alert('❌ Upload failed: ' + error.message);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = originalText;
  }
}
