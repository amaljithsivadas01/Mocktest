import { getExamQuestions, evaluateScore, submitGoogleForm } from '../lib/googleForms.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const { studentName, dept, answers = {}, durationSeconds = 0, batch } = body;

    if (!studentName || !studentName.trim()) {
      return res.status(400).json({ ok: false, error: 'Student name is required' });
    }
    if (!dept) {
      return res.status(400).json({ ok: false, error: 'Department is required' });
    }

    // 1. Fetch form metadata to get entry IDs & action URL
    const examData = await getExamQuestions(dept);

    // 2. Prepare Google Form submission payload
    const formPayload = {};
    if (examData.nameEntryId) {
      formPayload[`entry.${examData.nameEntryId}`] = studentName.trim();
    }
    if (examData.batchEntryId && batch) {
      formPayload[`entry.${examData.batchEntryId}`] = batch;
    } else if (examData.batchEntryId && dept === 'commerce') {
      formPayload[`entry.${examData.batchEntryId}`] = 'COMMERCE';
    }

    for (const [entryId, answer] of Object.entries(answers)) {
      formPayload[`entry.${entryId}`] = answer;
    }

    // 3. Submit to Google Form asynchronously
    const formSubmissionPromise = submitGoogleForm(examData.actionUrl, formPayload);

    // 4. Calculate final marks and score
    const score = evaluateScore(dept, answers);

    // 5. Notify Telegram Bot Webhook
    const botWebhookUrl = process.env.BOT_NOTIFY_URL;
    if (botWebhookUrl) {
      try {
        fetch(botWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: studentName.trim(),
            marks: score.marksObtained,
            maxMarks: score.maxMarks,
            percentage: score.percentage,
            department: examData.departmentName,
            examTitle: examData.title,
            durationSeconds,
            answersCount: Object.keys(answers).length,
            totalQuestions: examData.questions.length
          })
        }).catch(err => console.error('Telegram bot notification error:', err.message));
      } catch (e) {
        console.error('Failed to dispatch bot notification:', e.message);
      }
    }

    // Await form submission result (optional fallback if offline)
    await formSubmissionPromise;

    return res.status(200).json({
      ok: true,
      studentName: studentName.trim(),
      examTitle: examData.title,
      department: examData.departmentName,
      score: {
        marksObtained: score.marksObtained,
        maxMarks: score.maxMarks,
        percentage: score.percentage,
        correctCount: score.correctCount,
        totalQuestions: score.totalQuestions
      }
    });

  } catch (err) {
    console.error('Submission error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
