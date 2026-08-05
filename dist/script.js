// ============================================
// REDFLAG - QUIZ LOGIC + PAYMENT VERIFICATION
// ============================================

// ------------------------------
// 1. YOUR QUESTIONS (21 Questions)
// Replace these with YOUR actual questions!
// ------------------------------
const questions = [
  {
    question: "Do you often interrupt others while they're speaking?",
    options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
    weights: [0, 1, 2, 3, 4]
  },
  {
    question: "Do you take responsibility for your mistakes?",
    options: ["Always", "Usually", "Sometimes", "Rarely", "Never"],
    weights: [0, 1, 2, 3, 4]
  },
  {
    question: "Do you frequently check your partner's phone without permission?",
    options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
    weights: [0, 1, 2, 3, 4]
  }
  // 👆 Add your remaining 18 questions here!
];

// ------------------------------
// 2. GAME STATE
// ------------------------------
let currentQuestion = 0;
let score = 0;
let userAnswers = [];
let paymentVerified = false;
let isUnlocked = false;

// DOM elements
const app = document.getElementById('app');
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');
const questionEl = document.getElementById('question');
const optionsEl = document.getElementById('options');
const progressEl = document.getElementById('progress');
const startBtn = document.getElementById('start-btn');
const resultScoreEl = document.getElementById('result-score');
const resultMessageEl = document.getElementById('result-message');
const unlockBtn = document.getElementById('unlock-btn');

// ------------------------------
// 3. RENDER FUNCTIONS
// ------------------------------
function renderQuestion() {
  const q = questions[currentQuestion];
  questionEl.textContent = q.question;
  optionsEl.innerHTML = '';
  
  q.options.forEach((option, index) => {
    const btn = document.createElement('button');
    btn.textContent = option;
    btn.className = 'option-btn';
    btn.dataset.index = index;
    btn.addEventListener('click', () => selectOption(index));
    optionsEl.appendChild(btn);
  });
  
  progressEl.textContent = `${currentQuestion + 1} / ${questions.length}`;
}

function selectOption(index) {
  const q = questions[currentQuestion];
  const weight = q.weights[index];
  score += weight;
  userAnswers.push({ question: q.question, answer: q.options[index], weight });
  
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    renderQuestion();
  } else {
    showResults();
  }
}

function showResults() {
  quizScreen.style.display = 'none';
  resultScreen.style.display = 'block';
  
  const maxScore = questions.length * 4;
  const percentage = Math.round((score / maxScore) * 100);
  
  let level = '';
  let message = '';
  if (percentage < 20) { level = '🌿 Green Flag'; message = 'You are very self-aware and respectful!'; }
  else if (percentage < 40) { level = '🟡 Yellow Flag'; message = 'You have some areas to work on.'; }
  else if (percentage < 60) { level = '🟠 Orange Flag'; message = 'Red flags are showing! Time for self-reflection.'; }
  else { level = '🔴 Red Flag!'; message = '🚨 High toxicity detected. It\'s time to make serious changes.'; }
  
  resultScoreEl.textContent = `Score: ${score} / ${maxScore} (${percentage}%)`;
  resultMessageEl.textContent = `${level} - ${message}`;
  
  if (paymentVerified) {
    unlockBtn.style.display = 'block';
  } else {
    unlockBtn.style.display = 'none';
  }
}

// ------------------------------
// 4. PAYMENT VERIFICATION
// ------------------------------
async function verifyPayment(paymentId) {
  try {
    const response = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId })
    });
    
    const data = await response.json();
    
    if (data.verified) {
      paymentVerified = true;
      startQuiz();
    } else {
      alert('❌ Payment not found. Please contact support.');
      startScreen.style.display = 'block';
    }
  } catch (error) {
    console.error('Verification error:', error);
    alert('Error verifying payment. Please try again.');
    startScreen.style.display = 'block';
  }
}

// ------------------------------
// 5. START / UNLOCK
// ------------------------------
function startQuiz() {
  startScreen.style.display = 'none';
  quizScreen.style.display = 'block';
  renderQuestion();
}

function unlockResults() {
  alert('🔐 Please complete payment to unlock detailed results.');
  // window.location.href = 'https://gumroad.com/l/redflag';
}

// ------------------------------
// 6. INITIALIZATION (On Page Load)
// ------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentId = urlParams.get('payment_id');
  
  if (paymentId) {
    verifyPayment(paymentId);
  } else {
    startScreen.style.display = 'block';
  }
  
  if (startBtn) startBtn.addEventListener('click', startQuiz);
  if (unlockBtn) unlockBtn.addEventListener('click', unlockResults);
});
