import { getAllFormsMetadata } from '../lib/googleForms.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const data = await getAllFormsMetadata();
    return res.status(200).json({ ok: true, forms: data });
  } catch (err) {
    console.error('Error fetching forms metadata:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
