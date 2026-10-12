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
    const { studentName, dept, answers = {}, durationSeconds = 0, batch, school, medium } = body;

    if (!studentName || !studentName.trim()) {
      return res.status(400).json({ ok: false, error: 'Student name is required' });
    }
    if (!dept) {
      return res.status(400).json({ ok: false, error: 'Department is required' });
    }

    // 1. Fetch live form metadata to get active entry IDs & action URL
    const examData = await getExamQuestions(dept);

    // 2. Prepare Google Form submission payload
    const formPayload = {};
    if (examData.fbzx) {
      formPayload['fbzx'] = examData.fbzx;
    }
    if (examData.nameEntryId) {
      formPayload[`entry.${examData.nameEntryId}`] = studentName.trim();
    }
    if (examData.batchEntryId && batch) {
      formPayload[`entry.${examData.batchEntryId}`] = batch;
    } else if (examData.batchEntryId && dept === 'commerce') {
      formPayload[`entry.${examData.batchEntryId}`] = 'COMMERCE';
    }
    if (examData.schoolEntryId) {
      formPayload[`entry.${examData.schoolEntryId}`] = (school && school.trim()) || 'GHSS THRISSUR';
    }
    if (examData.mediumEntryId) {
      formPayload[`entry.${examData.mediumEntryId}`] = medium || 'ENGLISH';
    }

    for (const [entryId, answer] of Object.entries(answers)) {
      formPayload[`entry.${entryId}`] = answer;
    }

    // 3. Submit to Google Form and extract live evaluated score if available
    let formSubmissionResult = null;
    try {
      formSubmissionResult = await submitGoogleForm(examData.actionUrl, formPayload);
    } catch (e) {
      console.error('Google Form submission error:', e.message);
    }

    // 4. Determine final marks and score:
    // Priority A: Real live score evaluated by Google Forms directly from viewscore
    // Priority B: Dynamic fallback evaluator matching updated questions & answer keys
    let score = null;
    if (formSubmissionResult?.score) {
      score = formSubmissionResult.score;
      console.log(`[Score] Live Google Forms evaluated score: ${score.marksObtained}/${score.maxMarks}`);
    } else {
      score = evaluateScore(dept, answers, examData.questions, examData.prefilledKeys);
      console.log(`[Score] Fallback evaluated score: ${score.marksObtained}/${score.maxMarks}`);
    }

    // 5. Notify Telegram Bot Webhook & Persist Submission in Bot Storage
    // NOTE: Must be AWAITED so serverless execution doesn't terminate before webhook dispatches
    const botWebhookUrl = process.env.BOT_NOTIFY_URL || 'https://exam-notification-bot.vercel.app/api/notify';
    let botNotified = false;
    if (botWebhookUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const botPayload = {
          studentName: studentName.trim(),
          marks: score.marksObtained,
          maxMarks: score.maxMarks,
          percentage: score.percentage,
          department: examData.departmentName,
          examTitle: examData.title,
          durationSeconds,
          answersCount: Object.keys(answers).length,
          totalQuestions: examData.questions.length,
          viewscoreUrl: formSubmissionResult?.viewscoreUrl || null
        };

        const botRes = await fetch(botWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(botPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        botNotified = botRes.ok;
        console.log(`[Bot] Telegram bot notification delivered. Status: ${botRes.status}`);
      } catch (e) {
        console.error('Failed to dispatch bot notification:', e.message);
      }
    }

    return res.status(200).json({
      ok: true,
      studentName: studentName.trim(),
      examTitle: examData.title,
      department: examData.departmentName,
      formSubmitted: formSubmissionResult ? formSubmissionResult.ok : false,
      botNotified,
      score: {
        marksObtained: score.marksObtained,
        maxMarks: score.maxMarks,
        percentage: score.percentage,
        correctCount: score.correctCount,
        totalQuestions: score.totalQuestions,
        fromGoogle: Boolean(score.fromGoogle)
      }
    });

  } catch (err) {
    console.error('Submission error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
