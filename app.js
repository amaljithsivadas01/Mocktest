// ==========================================================================
// PAGE LEARNING - EXAM LOGIC & REAL-TIME INTERACTION
// ==========================================================================

const EXAM_DURATION_SECONDS = 30 * 60; // 30 minutes

let examData = null;
let timerInterval = null;
let timerStarted = false;
let timeRemaining = EXAM_DURATION_SECONDS;
let startTime = null;
let isSubmitting = false;

// 1. Initialize Page
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const dept = (urlParams.get('dept') || 'science').toLowerCase();

  await loadExamQuestions(dept);
  setupInteractionListeners();
});

// 2. Fetch Live Questions from Google Forms via API
async function loadExamQuestions(dept) {
  const badge = document.getElementById('exam-badge');
  const container = document.getElementById('questions-container');

  try {
    const res = await fetch(`/api/exam?dept=${encodeURIComponent(dept)}`);
    if (!res.ok) {
      throw new Error(`Failed to load exam data: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.ok || !data.exam) {
      throw new Error(data.error || 'Invalid exam data');
    }

    examData = data.exam;
    
    // Update Badge Title
    if (badge) {
      badge.textContent = examData.title || `${examData.departmentName} Exam`;
    }
    document.title = `${examData.title || 'Exam'} | Page Learning`;

    // Check Batch Field
    const batchContainer = document.getElementById('batch-field-container');
    if (batchContainer && examData.batchEntryId) {
      batchContainer.style.display = 'flex';
    }

    // Render Questions
    renderQuestions(examData.questions);

  } catch (err) {
    console.error('Error fetching questions:', err);
    if (container) {
      container.innerHTML = `
        <div style="text-align:center; padding: 30px; color: #dc2626;">
          <p style="font-weight: 700; margin-bottom: 8px;">Unable to load exam questions</p>
          <p style="font-size: 0.85rem; color: #64748b;">${err.message}</p>
          <button onclick="location.reload()" class="submit-exam-btn" style="margin: 16px auto; width: auto; padding: 10px 22px;">
            Retry
          </button>
        </div>
      `;
    }
  }
}

// 3. Render Question MCQs
function renderQuestions(questions) {
  const container = document.getElementById('questions-container');
  if (!container) return;

  if (!questions || questions.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #64748b;">No questions available.</p>';
    return;
  }

  let html = '';
  questions.forEach((q, index) => {
    const qNum = index + 1;
    const entryId = q.entryId;

    html += `
      <div class="question-block" data-entry-id="${entryId}" id="q-block-${index}">
        <div class="question-header">
          <span class="q-badge">Q${qNum}</span>
          <div class="question-text">${escapeHtml(q.title)}</div>
        </div>
        <div class="options-group">
    `;

    q.options.forEach((optionText, optIndex) => {
      const optionId = `q_${index}_opt_${optIndex}`;
      html += `
        <label class="option-label" for="${optionId}">
          <input
            type="radio"
            id="${optionId}"
            name="entry_${entryId}"
            value="${escapeHtml(optionText)}"
            required
          />
          <span class="option-text">${escapeHtml(optionText)}</span>
        </label>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Add click handlers for custom radio selection highlight
  container.querySelectorAll('.option-label').forEach(label => {
    label.addEventListener('click', () => {
      startTimerIfNeeded();
      const parentGroup = label.closest('.options-group');
      if (parentGroup) {
        parentGroup.querySelectorAll('.option-label').forEach(l => l.classList.remove('selected'));
        label.classList.add('selected');
      }
    });
  });
}

// 4. Timer Logic: 30 minutes, starts on first user interaction
function setupInteractionListeners() {
  const studentNameInput = document.getElementById('student-name');
  if (studentNameInput) {
    studentNameInput.addEventListener('input', startTimerIfNeeded);
    studentNameInput.addEventListener('focus', startTimerIfNeeded);
  }

  const form = document.getElementById('exam-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
}

function startTimerIfNeeded() {
  if (timerStarted) return;
  timerStarted = true;
  startTime = Date.now();

  const timerStatusLabel = document.getElementById('timer-status-label');
  if (timerStatusLabel) {
    timerStatusLabel.textContent = 'Time Remaining:';
  }

  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timeRemaining--;

    updateTimerDisplay();

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      timeRemaining = 0;
      updateTimerDisplay();
      handleTimeExpired();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  const progressBar = document.getElementById('timer-progress-bar');
  const timerBar = document.getElementById('sticky-timer-bar');

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (display) {
    display.textContent = formattedTime;
  }

  if (progressBar) {
    const progressPercent = (timeRemaining / EXAM_DURATION_SECONDS) * 100;
    progressBar.style.width = `${progressPercent}%`;
  }

  if (timerBar) {
    if (timeRemaining <= 60) {
      timerBar.classList.remove('warning');
      timerBar.classList.add('danger');
    } else if (timeRemaining <= 300) {
      timerBar.classList.add('warning');
    }
  }
}

function handleTimeExpired() {
  alert('⏰ 30 minutes duration reached! Your exam will now be submitted automatically.');
  const form = document.getElementById('exam-form');
  if (form && !isSubmitting) {
    handleFormSubmit(new Event('submit'));
  }
}

// 5. Submit Exam Handler
async function handleFormSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (isSubmitting) return;

  const studentNameInput = document.getElementById('student-name');
  const studentName = studentNameInput ? studentNameInput.value.trim() : '';

  if (!studentName) {
    alert('Please enter your full name before submitting.');
    studentNameInput?.focus();
    return;
  }

  // Gather answers
  const answers = {};
  if (examData && examData.questions) {
    examData.questions.forEach(q => {
      const selected = document.querySelector(`input[name="entry_${q.entryId}"]:checked`);
      if (selected) {
        answers[q.entryId] = selected.value;
      }
    });
  }

  // Check how many questions answered
  const totalQuestions = examData?.questions?.length || 20;
  const answeredCount = Object.keys(answers).length;

  if (answeredCount < totalQuestions && timeRemaining > 0) {
    const confirmSubmit = confirm(`You have answered ${answeredCount} of ${totalQuestions} questions. Are you sure you want to submit?`);
    if (!confirmSubmit) return;
  }

  isSubmitting = true;
  if (timerInterval) clearInterval(timerInterval);

  const submitBtn = document.getElementById('submit-exam-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="skeleton-shimmer" style="display:inline-block; width: 16px; height: 16px; border-radius: 50%;"></span>
      <span>Submitting Your Exam...</span>
    `;
  }

  const durationSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : (EXAM_DURATION_SECONDS - timeRemaining);
  const batchInput = document.getElementById('batch-input');
  const batch = batchInput ? batchInput.value : '';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName,
        dept: examData.dept,
        answers,
        durationSeconds,
        batch
      })
    });

    const result = await res.json();
    if (!result.ok) {
      throw new Error(result.error || 'Submission failed');
    }

    // Display Result Modal
    showResultModal({
      studentName,
      department: result.department || examData.departmentName,
      marks: result.score.marksObtained,
      maxMarks: result.score.maxMarks,
      percentage: result.score.percentage,
      correctCount: result.score.correctCount,
      totalQuestions: result.score.totalQuestions,
      durationSeconds
    });

  } catch (err) {
    console.error('Error submitting exam:', err);
    alert(`Submission error: ${err.message}. Please check your connection and try again.`);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Submit Exam</span>`;
    }
    isSubmitting = false;
  }
}

// 6. Show Result Modal
function showResultModal(data) {
  const modal = document.getElementById('result-modal');
  if (!modal) return;

  const scoreNum = document.getElementById('modal-score-num');
  const studentName = document.getElementById('modal-student-name');
  const correctCount = document.getElementById('modal-correct-count');
  const percentage = document.getElementById('modal-percentage');
  const timeTaken = document.getElementById('modal-time-taken');
  const deptLabel = document.getElementById('modal-dept-label');

  if (scoreNum) scoreNum.textContent = data.marks;
  if (studentName) studentName.textContent = data.studentName;
  if (correctCount) correctCount.textContent = `${data.correctCount} / ${data.totalQuestions}`;
  if (percentage) percentage.textContent = `${data.percentage}%`;
  
  const minutes = Math.floor(data.durationSeconds / 60);
  const seconds = data.durationSeconds % 60;
  if (timeTaken) timeTaken.textContent = `${minutes}m ${seconds}s`;

  if (deptLabel) deptLabel.textContent = `${data.department} Mock Test`;

  modal.classList.add('active');
}

// Utility: escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
