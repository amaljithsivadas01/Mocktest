// Helper library for fetching and parsing Google Forms in real time

const FORM_URLS = {
  science: process.env.SCIENCE_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLScx0EcpmwWnuPwVWEa5g22_vlekBUu8q3_WZRFRGFOni_da-Q/viewform',
  humanities: process.env.HUMANITIES_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLSfSsPceCoZt-K91EmTwDaPmZwQYVSmUAIg0zH6HAOzy4IAUhg/viewform',
  commerce: process.env.COMMERCE_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLSeOEdoTYgQe0qZd8C6Ojs8ViRct-klN3ft5jpuHlVO-te0cAw/viewform'
};

const DEPARTMENT_NAMES = {
  science: 'Department of Science',
  humanities: 'Department of Humanities',
  commerce: 'Department of Commerce'
};

// Answer keys for scoring (+5 marks per correct MCQ, total 100)
// Configured from the prefilled answer links provided by the instructor
const ANSWER_KEYS = {
  science: {
    '1669068372': 'A) Electrons flow from cathode to anode',
    '1255036988': 'A) Molten NaCl',
    '1876448429': 'A) Conductivity always increases',
    '690213809': 'B) Iron in dry air',
    '889242569': 'C) Nature of electrolyte',
    '43254479': 'C) 0.64 g',
    '477948474': 'C) 48250 C',
    '445604316': 'B) Volume increases',
    '2001338226': 'C) HCl',
    '1114802569': 'C) k decreases, while ^m increases',
    '351371600': 'C) ∆ G< 0, E°cell< 0, K > 1',
    '911161231': 'B) 2 x 96500 C',
    '1796069569': 'B) The concentration of Cu²⁺ is increased',
    '41701249': 'C) 128.5S cm²mol-¹',
    '1374359630': 'B) Both true, R not explanation',
    '269767712': 'B) Both true, R not explanation',
    '1370629946': 'C) A true, R false',
    '1870250926': 'B) Both true, R not explanation',
    '840641748': 'B) Both true, R not explanation'
  },
  humanities: {
    '915370348': 'B. 1 and 2 only',
    '225815456': 'B. Expansion of irrigation and cultivation of fertile areas',
    '1079617794': 'B. Ganas/sanghas were oligarchic or republican forms in which power was exercised by a group rather than a single hereditary monarch.',
    '630051933': 'B. 3 only',
    '513993981': 'B. Collection of revenue from agricultural production',
    '1690110606': 'B. They could involve the transfer of revenue from a particular area to religious or other beneficiaries.',
    '1690215469': 'B. 1, 3 and 4 only',
    '1534763594': 'A. They contain no information about rulers.',
    '1210973515': 'B. The presence of NBPW can indicate connections with the urban and economic developments of the period.',
    '2040000420': 'B. They organised groups of artisans or merchants and could regulate aspects of economic activity.',
    '928293410': 'C. The entire population of the settlement must have used coins regularly.',
    '190262264': 'B. 4 → 3 → 2 → 1',
    '497382118': 'B. 2 only',
    '103529954': 'B. It eliminated the need for taxation.',
    '1771562497': 'B. A-2, B-1, C-4, D-3',
    '443895555': 'B. Different sources can complement one another and help identify contradictions or limitations.',
    '2062550265': 'B. Both Statement I and Statement II are incorrect'
  },
  commerce: {
    '25065927': '(b) growth of the organisation',
    '2109890931': '(b) Social',
    '1499782116': '(b) Efficiently',
    '259959411': '(b) Middle level',
    '859011970': '(b) Planning',
    '2076737672': '(b) top level management',
    '1666550490': '(b) the essence of management',
    '1223028991': '(b) Management helps in achieving individual goals only',
    '1037984757': '(c) Organisational objectives',
    '1416434502': '(b) An effective manager',
    '135492979': '(b) Decentralisation',
    '1289615675': '(b) Management is a goal oriented process',
    '1863065142': '(c) Management is all pervasive',
    '1465310019': '(c) Management of operations',
    '1919909519': '(c) Each member of the organisation may have different individual goals but they must travel together towards common goals.',
    '1541349289': '(b) A group activity',
    '1329717638': '(b) They are responsible for the welfare and survival of the organisation.',
    '1755972982': '(b) Operational management',
    '1296262842': '(b) Organising'
  }
};

// Cache for real-time form data (TTL: 15 seconds)
const cache = {
  forms: {},
  lastFetch: {}
};
const CACHE_TTL_MS = 15000;

/**
 * Fetch and parse raw Google Form public HTML
 */
async function fetchRawFormData(dept) {
  const url = FORM_URLS[dept];
  if (!url) {
    throw new Error(`Unknown department: ${dept}`);
  }

  const now = Date.now();
  if (cache.forms[dept] && (now - (cache.lastFetch[dept] || 0) < CACHE_TTL_MS)) {
    return cache.forms[dept];
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Google Form for ${dept}: HTTP ${res.status}`);
  }

  const html = await res.text();
  const match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.+?\]);\s*<\/script>/s);
  if (!match) {
    throw new Error(`Could not parse FB_PUBLIC_LOAD_DATA_ from Google Form for ${dept}`);
  }

  const data = JSON.parse(match[1]);
  const formIdMatch = url.match(/\/forms\/d\/e\/([a-zA-Z0-9_-]+)\//);
  const formId = formIdMatch ? formIdMatch[1] : '';

  const parsed = {
    dept,
    departmentName: DEPARTMENT_NAMES[dept],
    formId,
    url,
    actionUrl: `https://docs.google.com/forms/d/e/${formId}/formResponse`,
    title: data[1][8] || data[3] || 'Exam Form',
    description: data[1][0] || '',
    items: data[1][1] || []
  };

  cache.forms[dept] = parsed;
  cache.lastFetch[dept] = now;
  return parsed;
}

/**
 * Extract simple exam title for landing page button display
 */
export async function getFormMetadata(dept) {
  const raw = await fetchRawFormData(dept);
  return {
    dept: raw.dept,
    departmentName: raw.departmentName,
    title: raw.title,
    description: raw.description,
    formId: raw.formId
  };
}

/**
 * Extract all active exam metadata for the landing page
 */
export async function getAllFormsMetadata() {
  const depts = ['science', 'humanities', 'commerce'];
  const results = await Promise.allSettled(depts.map(d => getFormMetadata(d)));
  
  const output = {};
  depts.forEach((dept, i) => {
    if (results[i].status === 'fulfilled') {
      output[dept] = results[i].value;
    } else {
      console.error(`Error fetching form for ${dept}:`, results[i].reason);
      output[dept] = {
        dept,
        departmentName: DEPARTMENT_NAMES[dept],
        title: dept === 'science' ? 'Chemistry' : dept === 'humanities' ? 'History' : 'Business Studies',
        description: 'Mock Test',
        error: true
      };
    }
  });
  return output;
}

/**
 * Get structured exam questions for the custom exam page
 */
export async function getExamQuestions(dept) {
  const raw = await fetchRawFormData(dept);

  let nameEntryId = null;
  let batchEntryId = null;
  const questions = [];

  for (const item of raw.items) {
    const title = (item[1] || '').trim();
    const type = item[3]; // 0: short text, 2: radio choice, 3: dropdown, 4: checkbox
    const entryId = item[4]?.[0]?.[0];
    const required = item[4]?.[0]?.[2] === 1;
    const options = (item[4]?.[0]?.[1] || []).map(opt => opt[0]);

    if (!entryId) continue;

    // Check if this is the student name field
    const lowerTitle = title.toLowerCase();
    if (type === 0 && (lowerTitle.includes('name') || lowerTitle.includes('student'))) {
      nameEntryId = entryId;
      continue;
    }

    // Check if this is batch/stream field (e.g. in Commerce form)
    if (lowerTitle.includes('batch') || lowerTitle.includes('stream')) {
      batchEntryId = entryId;
      continue;
    }

    questions.push({
      id: item[0],
      title: title.replace(/<[^>]+>/g, '').trim(),
      entryId: String(entryId),
      type,
      required,
      options
    });
  }

  return {
    dept: raw.dept,
    departmentName: raw.departmentName,
    title: raw.title,
    description: raw.description,
    formId: raw.formId,
    actionUrl: raw.actionUrl,
    nameEntryId: String(nameEntryId || ''),
    batchEntryId: String(batchEntryId || ''),
    questions
  };
}

/**
 * Calculate final marks based on submitted answers
 * +5 marks per correct answer, 0 for incorrect. Total 100 marks.
 */
export function evaluateScore(dept, answers) {
  const keys = ANSWER_KEYS[dept] || {};
  let correctCount = 0;
  let totalQuestions = Object.keys(keys).length || 20;

  const evaluationDetails = [];

  for (const [entryId, correctOption] of Object.entries(keys)) {
    const studentAnswer = (answers[entryId] || '').trim();
    // Normalize comparison: ignore whitespace difference and letter prefixes if needed
    const isCorrect = normalizeAnswer(studentAnswer) === normalizeAnswer(correctOption);
    if (isCorrect) {
      correctCount++;
    }
    evaluationDetails.push({
      entryId,
      studentAnswer,
      isCorrect
    });
  }

  const marksObtained = correctCount * 5;
  const maxMarks = 100;
  const percentage = Math.round((marksObtained / maxMarks) * 100);

  return {
    correctCount,
    totalQuestions,
    marksObtained,
    maxMarks,
    percentage,
    details: evaluationDetails
  };
}

function normalizeAnswer(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Submit response to Google Form
 */
export async function submitGoogleForm(actionUrl, formData) {
  try {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(formData)) {
      if (v !== undefined && v !== null) {
        params.append(k, String(v));
      }
    }

    const res = await fetch(actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error('Error submitting to Google Forms:', err);
    return { ok: false, error: err.message };
  }
}
