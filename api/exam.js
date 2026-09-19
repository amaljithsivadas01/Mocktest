import { getExamQuestions } from '../lib/googleForms.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const dept = (req.query?.dept || (req.url && new URL(req.url, 'http://localhost').searchParams.get('dept')) || 'science').toLowerCase();

  try {
    const examData = await getExamQuestions(dept);
    return res.status(200).json({ ok: true, exam: examData });
  } catch (err) {
    console.error(`Error fetching exam data for ${dept}:`, err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
