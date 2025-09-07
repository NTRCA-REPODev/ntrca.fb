const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory storage (replace with database in production)
let exams = {};
let participants = {};
let leaderboards = {};
let activeUsers = [];

// API Routes

// 1. Get exam data
app.get('/api/exam', (req, res) => {
  const examId = Object.keys(exams)[0]; // Get the first exam (simplified)
  if (exams[examId]) {
    res.json(exams[examId]);
  } else {
    res.status(404).json({ error: 'No exam found' });
  }
});

// 2. Create new exam (admin)
app.post('/api/exam', (req, res) => {
  const { password, examData } = req.body;
  
  // Simple admin authentication
  if (password !== 'FahimsirNTRCA') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const examId = uuidv4();
  exams[examId] = {
    id: examId,
    ...examData,
    createdAt: new Date().toISOString()
  };
  
  // Initialize leaderboard for this exam
  leaderboards[examId] = [];
  
  res.json({ 
    success: true, 
    examId,
    message: 'Exam created successfully' 
  });
});

// 3. Submit exam answers
app.post('/api/exam/submit', (req, res) => {
  const { participantName, examId, answers } = req.body;
  
  if (!exams[examId]) {
    return res.status(404).json({ error: 'Exam not found' });
  }
  
  // Calculate score
  const exam = exams[examId];
  let correctCount = 0;
  let wrongCount = 0;
  
  exam.questions.forEach((question, index) => {
    if (answers[index] === question.correct_answer) {
      correctCount++;
    } else if (answers[index] !== null) {
      wrongCount++;
    }
  });
  
  // Apply negative marking: -1 for every 4 wrong answers
  const negativeMarks = Math.floor(wrongCount / 4);
  const score = correctCount - negativeMarks;
  
  // Save participant result
  if (!participants[examId]) {
    participants[examId] = {};
  }
  
  participants[examId][participantName] = {
    name: participantName,
    answers,
    score,
    submittedAt: new Date().toISOString()
  };
  
  // Update leaderboard
  leaderboards[examId].push({
    name: participantName,
    score,
    submittedAt: new Date().toISOString()
  });
  
  // Sort leaderboard by score (descending)
  leaderboards[examId].sort((a, b) => b.score - a.score);
  
  // Remove from active users
  activeUsers = activeUsers.filter(user => 
    !(user.name === participantName && user.examId === examId)
  );
  
  res.json({
    success: true,
    score,
    totalQuestions: exam.questions.length,
    correctCount,
    wrongCount,
    negativeMarks
  });
});

// 4. Get leaderboard
app.get('/api/leaderboard/:examId', (req, res) => {
  const { examId } = req.params;
  
  if (!leaderboards[examId]) {
    return res.status(404).json({ error: 'Leaderboard not found for this exam' });
  }
  
  res.json(leaderboards[examId]);
});

// 5. Get user profile
app.get('/api/profile/:name', (req, res) => {
  const { name } = req.params;
  const userExams = [];
  
  // Find all exams this user has participated in
  Object.keys(participants).forEach(examId => {
    if (participants[examId][name]) {
      userExams.push({
        examId,
        examTitle: exams[examId]?.title || 'NTRCA Prelim Test',
        score: participants[examId][name].score,
        total: exams[examId]?.questions.length || 0,
        date: participants[examId][name].submittedAt
      });
    }
  });
  
  res.json({
    name,
    exams: userExams
  });
});

// 6. Add active user
app.post('/api/active-users', (req, res) => {
  const { name, examId } = req.body;
  
  // Remove if already exists
  activeUsers = activeUsers.filter(user => 
    !(user.name === name && user.examId === examId)
  );
  
  // Add new active user
  activeUsers.push({
    name,
    examId,
    startTime: new Date().toISOString()
  });
  
  res.json({ success: true });
});

// 7. Remove active user
app.delete('/api/active-users', (req, res) => {
  const { name, examId } = req.body;
  
  activeUsers = activeUsers.filter(user => 
    !(user.name === name && user.examId === examId)
  );
  
  res.json({ success: true });
});

// 8. Get active users
app.get('/api/active-users/:examId', (req, res) => {
  const { examId } = req.params;
  const users = activeUsers.filter(user => user.examId === examId);
  
  res.json(users);
});

// 9. Check if user has already taken exam
app.get('/api/exam-taken/:examId/:name', (req, res) => {
  const { examId, name } = req.params;
  
  const hasTaken = participants[examId] && participants[examId][name];
  res.json({ taken: !!hasTaken });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Basic error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});
