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
export const ANSWER_KEYS = {
  science: {
    '1669068372': 'a) 1.8×10^4 " " V',
    '1255036988': 'd) 200 J',
    '1876448429': 'b) -54 J',
    '690213809': 'a) 3.6×104 𝑉',
    '889242569': 'b) 9×105 𝑉',
    '43254479': 'a) Dipole is parallel to field',
    '477948474': 'b) 30 J',
    '1083102793': 'a) Constant',
    '445604316': 'a) 5.4×1010 𝐽',
    '2001338226': 'a) 𝑉=𝑘𝑞/𝑟',
    '1114802569': 'b) 4.5×105 𝑉',
    '351371600': 'a) Dipole is anti-parallel to field',
    '911161231': 'a) Maximum',
    '1796069569': 'b) Product of potentials due to individual charges',
    '41701249': 'a) 1.8×105 𝑉',
    '1374359630': 'b) -9×109 𝐽',
    '269767712': 'c) 1/𝑟3',
    '1370629946': 'b) Distance',
    '1870250926': 'c) 9×104 𝑉',
    '840641748': 'd) All of the above'
  },
  humanities: {
    '915370348': '(b)Racial discrimination',
    '1787485434': '(b) 1955',
    '225815456': '(d)USA and USSR.',
    '1079617794': '(d)Atal Bihari Vajpayee',
    '630051933': '(a)Suez Canal problem',
    '513993981': '(a)Non-aligned',
    '1690110606': '(a)Neutrality',
    '1690215469': '(b)North East Frontier Agency',
    '316055522': '(c)October 1962',
    '1534763594': 'Jawaharlal Nehru',
    '1210973515': 'The Prime Minister of China Zhou Enlai',
    '1283509418': 'Pt. Nehru',
    '2040000420': 'Jawaharlal Nehru',
    '928293410': 'December 1971',
    '190262264': 'Jawaharlal Nehru',
    '497382118': 'October 1962',
    '103529954': 'Vallabhbhai Patel',
    '1771562497': '1955',
    '443895555': 'Meghalaya',
    '2062550265': '(b) Indonesia'
  },
  commerce: {
    '25065927': 'b) Indian Partnership Act, 1932',
    '2109890931': 'b) 2',
    '1499782116': 'c) Partners',
    '259959411': 'b) Partnership Deed',
    '859011970': 'c) Equally',
    '354569852': 'c) Not allowed',
    '2076737672': 'd) Not charged',
    '1666550490': 'b) 6% p.a.',
    '1223028991': 'c) Active partner',
    '1037984757': 'b) Sleeping partner',
    '1416434502': 'c) Nominal partner',
    '135492979': 'b) Unlimited',
    '1289615675': 'a) Mutual agency',
    '1863065142': 'c) Profit and Loss Account',
    '1465310019': 'a) Profit and Loss Appropriation Account',
    '1919909519': 'b) Appropriation of profit',
    '1541349289': 'c) Drawings',
    '1329717638': 'b) Capital',
    '1755972982': 'a) Equally',
    '1296262842': 'd) Compulsory registration'
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
        title: dept === 'science' ? 'Physics' : dept === 'humanities' ? 'Political Science' : 'Accountancy',
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
