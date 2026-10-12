// Helper library for fetching and parsing Google Forms in real time

const FORM_URLS = {
  science: process.env.SCIENCE_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLScx0EcpmwWnuPwVWEa5g22_vlekBUu8q3_WZRFRGFOni_da-Q/viewform',
  humanities: process.env.HUMANITIES_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLSfSsPceCoZt-K91EmTwDaPmZwQYVSmUAIg0zH6HAOzy4IAUhg/viewform',
  commerce: process.env.COMMERCE_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLSeOEdoTYgQe0qZd8C6Ojs8ViRct-klN3ft5jpuHlVO-te0cAw/viewform',
  others: process.env.OTHERS_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLSclE-E1CdOD9-UNLPWGxQ8B4aRX8JCY5uVDOgL5jPH5QnIaIA/viewform'
};

const DEPARTMENT_NAMES = {
  science: 'Department of Science',
  humanities: 'Department of Humanities',
  commerce: 'Department of Commerce',
  others: 'Department of Others'
};

// Answer keys for scoring fallback (+5 marks per correct MCQ, total 100)
// Supports active forms, updated series, and legacy keys
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
  },
  others: {
    // Active NMMS Series 3 Keys
    '674329024': '2.6251',
    '377022912': 'QUJNE',
    '1517577476': 'ANUXR',
    '1189729116': '124056',
    '1823588785': 'EARLY',
    '1907945616': '3.CTRISTRE',
    '935987079': '1.OCLLGEE',
    '1423654487': '2.BMAALUECN',
    '1323208391': '1.XOVET',
    '1008518733': '4.RXIOFP',
    '1967947755': '2. 12',
    '603379389': '2. BBLJNZB',
    '1858792142': '4. 30',
    '1273110592': '2. 2',
    '565261917': '1. MALAYALAM',
    '2146643862': '3. ROANEMTNLA',
    '1593113170': '2. anraew',
    '925273465': '3. ygioynityon',
    '1390106360': '2. 29861635',
    '1731494030': '2. 736415',
    // Series 1 Fallback Keys
    'legacy_direction_1': 'A) South / തെക്ക്',
    'legacy_direction_2': 'B) West / പടിഞ്ഞാറ്',
    'legacy_direction_3': 'A) 4 km / 4 കി.മീ',
    'legacy_direction_4': 'A) North / വടക്ക്',
    'legacy_direction_5': 'C) 14 km / 14 കി.മീ'
  }
};

// Cache for real-time form data (TTL: 15 seconds)
const cache = {
  forms: {},
  lastFetch: {}
};
const CACHE_TTL_MS = 15000;

/**
 * Extract answer keys from a Google Form pre-filled URL if provided
 * e.g. https://docs.google.com/forms/d/e/.../viewform?usp=pp_url&entry.123=Answer
 */
export function extractPrefilledKeys(url) {
  if (!url || !url.includes('entry.')) return {};
  try {
    const u = new URL(url);
    const keys = {};
    for (const [k, v] of u.searchParams.entries()) {
      if (k.startsWith('entry.')) {
        keys[k.replace('entry.', '')] = v;
      }
    }
    return keys;
  } catch (e) {
    return {};
  }
}

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

  const fbzxMatch = html.match(/name="fbzx"\s+value="([^"]+)"/);
  const fbzx = fbzxMatch ? fbzxMatch[1] : '';
  const requiresSignIn = data[1]?.[10]?.[1] === 1;

  const parsed = {
    dept,
    departmentName: DEPARTMENT_NAMES[dept],
    formId,
    url,
    fbzx,
    requiresSignIn,
    actionUrl: `https://docs.google.com/forms/d/e/${formId}/formResponse`,
    title: data[1][8] || data[3] || 'Exam Form',
    description: data[1][0] || '',
    items: data[1][1] || [],
    prefilledKeys: extractPrefilledKeys(url)
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
    formId: raw.formId,
    requiresSignIn: raw.requiresSignIn
  };
}

/**
 * Extract all active exam metadata for the landing page
 */
export async function getAllFormsMetadata() {
  const depts = ['science', 'humanities', 'commerce', 'others'];
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
        title: dept === 'science' ? 'Physics' : dept === 'humanities' ? 'Political Science' : dept === 'commerce' ? 'Accountancy' : 'NMMS MODEL TEST SERIES- 3',
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
  let batchOptions = [];
  let schoolEntryId = null;
  let mediumEntryId = null;
  let mediumOptions = [];
  const questions = [];

  for (const item of raw.items) {
    const title = (item[1] || '').trim();
    const type = item[3]; // 0: short text, 2: radio choice, 3: dropdown, 4: checkbox
    const entryId = item[4]?.[0]?.[0];
    const required = item[4]?.[0]?.[2] === 1;
    const options = (item[4]?.[0]?.[1] || []).map(opt => opt[0]);

    if (!entryId) continue;

    const lowerTitle = title.toLowerCase();

    // Check if this is the student name field
    if (type === 0 && (lowerTitle.includes('name') || lowerTitle.includes('student') || lowerTitle.includes('candidate'))) {
      nameEntryId = entryId;
      continue;
    }

    // Check if this is batch/stream field (e.g. in Commerce form)
    if (lowerTitle.includes('batch') || lowerTitle.includes('stream')) {
      batchEntryId = entryId;
      batchOptions = options;
      continue;
    }

    // Check if school field
    if (type === 0 && lowerTitle.includes('school')) {
      schoolEntryId = entryId;
      continue;
    }

    // Check if medium field
    if (lowerTitle.includes('medium')) {
      mediumEntryId = entryId;
      mediumOptions = options;
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
    fbzx: raw.fbzx,
    requiresSignIn: raw.requiresSignIn,
    actionUrl: raw.actionUrl,
    nameEntryId: String(nameEntryId || ''),
    batchEntryId: String(batchEntryId || ''),
    batchOptions,
    schoolEntryId: String(schoolEntryId || ''),
    mediumEntryId: String(mediumEntryId || ''),
    mediumOptions,
    prefilledKeys: raw.prefilledKeys,
    questions
  };
}

/**
 * Normalizes answer text by stripping whitespace, punctuation, and casing
 */
export function normalizeAnswer(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\p{L}\p{N}]/gu, '')
    .trim();
}

/**
 * Strips option letter prefixes like 'a)', '(b)', '1.', '2. '
 */
export function stripOptionPrefix(str) {
  return (str || '')
    .trim()
    .replace(/^(\(?[a-d1-4]\)?[\.\)]?\s*)/i, '')
    .trim();
}

/**
 * Flexible answer matcher handling option prefixes, whitespace, casing, and Unicode
 */
export function matchesAnswer(studentAnswer, correctAnswer) {
  if (!studentAnswer || !correctAnswer) return false;
  const s = studentAnswer.trim();
  const c = correctAnswer.trim();
  if (s === c) return true;
  if (normalizeAnswer(s) === normalizeAnswer(c)) return true;

  const sStripped = stripOptionPrefix(s);
  const cStripped = stripOptionPrefix(c);
  if (sStripped && cStripped && normalizeAnswer(sStripped) === normalizeAnswer(cStripped)) {
    return true;
  }

  // Check if option letter alone matches: (e.g. "(b)" matches "b)")
  const sLetter = s.match(/^\(?([a-d1-4])\)?[\.\)]?/i)?.[1]?.toLowerCase();
  const cLetter = c.match(/^\(?([a-d1-4])\)?[\.\)]?/i)?.[1]?.toLowerCase();
  if (sLetter && cLetter && sLetter === cLetter) {
    if (!sStripped || !cStripped || normalizeAnswer(sStripped) === normalizeAnswer(cStripped)) {
      return true;
    }
  }

  if (sLetter && !cLetter && normalizeAnswer(sStripped) === normalizeAnswer(c)) {
    return true;
  }
  if (!sLetter && cLetter && normalizeAnswer(s) === normalizeAnswer(cStripped)) {
    return true;
  }

  return false;
}

/**
 * Calculate final marks based on submitted answers
 * Dynamically supports prefilled keys, updated form questions, and answer keys.
 */
export function evaluateScore(dept, answers, examQuestions = [], dynamicPrefilledKeys = {}) {
  const staticKeys = ANSWER_KEYS[dept] || {};
  const mergedKeys = { ...staticKeys, ...(dynamicPrefilledKeys || {}) };

  let correctCount = 0;
  const totalQuestions = (examQuestions && examQuestions.length > 0)
    ? examQuestions.length
    : (Object.keys(mergedKeys).length || 20);

  const evaluationDetails = [];

  if (examQuestions && examQuestions.length > 0) {
    examQuestions.forEach((q, index) => {
      const entryId = String(q.entryId);
      const studentAnswer = (answers[entryId] || '').trim();

      // Look for answer key:
      // 1. By entryId in mergedKeys
      // 2. By question index (e.g. q_1)
      // 3. By question title match
      let correctOption = mergedKeys[entryId];
      if (!correctOption && mergedKeys[`q_${index + 1}`]) {
        correctOption = mergedKeys[`q_${index + 1}`];
      }
      if (!correctOption) {
        const normTitle = normalizeAnswer(q.title);
        for (const [k, v] of Object.entries(mergedKeys)) {
          if (normalizeAnswer(k) === normTitle || (normTitle && normTitle.includes(normalizeAnswer(k)))) {
            correctOption = v;
            break;
          }
        }
      }

      const isCorrect = correctOption ? matchesAnswer(studentAnswer, correctOption) : false;
      if (isCorrect) {
        correctCount++;
      }

      evaluationDetails.push({
        entryId,
        questionTitle: q.title,
        studentAnswer,
        correctAnswer: correctOption || '',
        isCorrect
      });
    });
  } else {
    for (const [entryId, correctOption] of Object.entries(mergedKeys)) {
      const studentAnswer = (answers[entryId] || '').trim();
      const isCorrect = matchesAnswer(studentAnswer, correctOption);
      if (isCorrect) {
        correctCount++;
      }
      evaluationDetails.push({
        entryId,
        studentAnswer,
        correctAnswer: correctOption,
        isCorrect
      });
    }
  }

  const marksPerQuestion = totalQuestions === 25 ? 4 : (100 / (totalQuestions || 20));
  const marksObtained = Math.round(correctCount * marksPerQuestion);
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

/**
 * Submit response to Google Form and extract live evaluated score from viewscore if available
 */
export async function submitGoogleForm(actionUrl, formData) {
  try {
    const params = new URLSearchParams();
    if (!formData.fvv) params.append('fvv', '1');
    if (!formData.pageHistory) params.append('pageHistory', '0');

    for (const [k, v] of Object.entries(formData)) {
      if (v !== undefined && v !== null) {
        params.append(k, String(v));
      }
    }

    const res = await fetch(actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: params.toString()
    });

    const responseText = await res.text();

    // Check if Google Forms returned a viewscore link
    let viewscoreUrl = null;
    const viewscoreMatch = responseText.match(/https:\/\/docs\.google\.com\/forms\/d\/e\/[a-zA-Z0-9_-]+\/viewscore\?viewscore=[a-zA-Z0-9_-]+/);
    if (viewscoreMatch) {
      viewscoreUrl = viewscoreMatch[0];
    }

    let liveScore = null;
    if (viewscoreUrl) {
      try {
        const scoreRes = await fetch(viewscoreUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        const scoreHtml = await scoreRes.text();

        // Match total points, e.g. "Total points<span ...>45/100</span>"
        const pointsSpanMatch = scoreHtml.match(/Total points<span[^>]*>\s*(\d+)\s*\/\s*(\d+)\s*<\/span>/i) ||
                                scoreHtml.match(/class="[^"]*RVEQke[^"]*"[^>]*>\s*(\d+)\s*\/\s*(\d+)\s*<\/span>/i) ||
                                scoreHtml.match(/(\d+)\s*\/\s*(\d+)/);

        if (pointsSpanMatch) {
          const marksObtained = parseInt(pointsSpanMatch[1], 10);
          const maxMarks = parseInt(pointsSpanMatch[2], 10);
          const percentage = Math.round((marksObtained / maxMarks) * 100);

          // Count individual question points: role="note" aria-label="Points received for this question.">5/5</div>
          const qPointsMatches = [...scoreHtml.matchAll(/role="note"\s+aria-label="Points received for this question\."[^>]*>\s*(\d+)\s*\/\s*(\d+)\s*<\/div>/gi)];
          let correctCount = 0;
          let totalQuestions = qPointsMatches.length;
          if (qPointsMatches.length > 0) {
            correctCount = qPointsMatches.filter(m => parseInt(m[1], 10) > 0).length;
          } else {
            correctCount = Math.round((marksObtained / (maxMarks || 100)) * (totalQuestions || 20));
          }

          liveScore = {
            marksObtained,
            maxMarks,
            percentage,
            correctCount,
            totalQuestions: totalQuestions || 20,
            fromGoogle: true,
            viewscoreUrl
          };
        }
      } catch (err) {
        console.error('Error fetching live score from viewscore:', err.message);
      }
    }

    if (!res.ok) {
      if (res.status === 401) {
        console.warn('Google Form returned 401 Unauthorized: Form likely requires Google Sign-in ("Limit to 1 response" is enabled in Form settings).');
      } else {
        console.warn(`Google Form submission returned HTTP ${res.status}`);
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      viewscoreUrl,
      score: liveScore
    };
  } catch (err) {
    console.error('Error submitting to Google Forms:', err);
    return { ok: false, error: err.message, status: 0 };
  }
}
