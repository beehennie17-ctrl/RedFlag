const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';

const RISK_BY_QUESTION = {
  4: { single: 0, situationship: 3, taken: 1, complicated: 4 },
  7: { instantly: 3, fewmin: 0, hours: 2, delivered: 4 },
  10: { doubletext: 3, thirsttrap: 4, block: 4, pretend: 1 },
  13: { textq: 3, call: 4, overthink: 2, sleep: 0 },
  16: { ignore: 0, nmu: 3, hardtoget: 2, pullup: 4 },
  19: { paragraphs: 3, k: 4, voicenotes: 2, ghost: 4 },
  23: { never: 0, important: 1, allthetime: 3, triple: 4 },
  26: { zero: 0, onetwo: 2, threetofive: 3, lostcount: 4 },
  30: { toxic: 2, clingy: 3, cheated: 1, nosituationships: 0 },
  33: { immediately: 4, afterdate: 2, dontcheck: 0, already: 3 },
  36: { attention: 4, fix: 4, stable: 0, notype: 2 },
  39: { months: 1, weeks: 2, day1: 4, neverlove: 3 },
  42: { communicate: 0, passive: 3, spy: 4, unbothered: 2 },
  45: { neverghost: 0, lastweek: 3, currently: 4, ghosted: 1 },
  48: { neverphone: 0, suspicious: 2, checkphone: 4, nopartner: 1 },
  52: { glowup: 3, removetrace: 2, stalk: 4, vague: 3 },
  55: { askabout: 0, deleteit: 3, hotterpic: 4, dontbother: 0 },
  58: { rightrp: 2, picky: 1, pushaway: 3, idontknow: 2 },
  61: { secure: 0, anxious: 2, avoidant: 3, dontknowstyle: 1 },
  64: { greenflag: 0, midflag: 2, knowwhatiam: 3, unhinged: 4 }
};

const CATEGORY_QUESTION_IDS = {
  texting: [7, 10, 13, 16, 19, 23],
  dating: [4, 26, 30, 36, 39, 58, 61],
  redflags: [33, 42, 45, 48, 52, 55, 64]
};

const QUESTION_RANGES = Object.fromEntries(
  Object.entries(RISK_BY_QUESTION).map(([questionId, answers]) => {
    const values = Object.values(answers);
    return [questionId, { min: Math.min(...values), max: Math.max(...values) }];
  })
);

const MIN_RAW_SCORE = Object.values(QUESTION_RANGES).reduce(
  (sum, range) => sum + range.min,
  0
);
const MAX_RAW_SCORE = Object.values(QUESTION_RANGES).reduce(
  (sum, range) => sum + range.max,
  0
);

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

function getLabel(score) {
  if (score <= 12) return 'Bro Actually Has Emotional Intelligence';
  if (score <= 24) return 'Rare W. Don\'t Ruin It.';
  if (score <= 36) return 'You\'re Kinda Toxic Ngl';
  if (score <= 48) return 'Walking Red Flag';
  if (score <= 60) return 'Heartbreaker';
  if (score <= 72) return 'Godspeed To Your Future Partner';
  return 'Absolutely Unhinged';
}

function getLevel(score) {
  if (score <= 12) return 'Level 1';
  if (score <= 24) return 'Level 2';
  if (score <= 36) return 'Level 3';
  if (score <= 48) return 'Level 4';
  if (score <= 60) return 'Level 5';
  if (score <= 72) return 'Level 6';
  return 'Level 7';
}

function sanitizeAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new Error('Quiz answers are missing.');
  }

  const sanitized = {};
  for (const [questionId, allowedAnswers] of Object.entries(RISK_BY_QUESTION)) {
    const answer = answers[questionId];
    if (!Object.prototype.hasOwnProperty.call(allowedAnswers, answer)) {
      throw new Error('Quiz answers are incomplete or invalid.');
    }
    sanitized[questionId] = answer;
  }
  return sanitized;
}

function scoreAnswers(answers) {
  const sanitized = sanitizeAnswers(answers);
  const pointsByQuestion = {};
  for (const [questionId, allowedAnswers] of Object.entries(RISK_BY_QUESTION)) {
    const answer = sanitized[questionId];
    pointsByQuestion[questionId] = allowedAnswers[answer];
  }

  const rawScore = Object.values(pointsByQuestion).reduce((sum, points) => sum + points, 0);
  const rawRange = MAX_RAW_SCORE - MIN_RAW_SCORE;
  const normalizedRisk = rawRange > 0 ? (rawScore - MIN_RAW_SCORE) / rawRange : 0;
  const score = Math.round(normalizedRisk * 84);

  const categories = {};
  for (const [category, questionIds] of Object.entries(CATEGORY_QUESTION_IDS)) {
    const categoryPoints = questionIds.reduce(
      (sum, questionId) => sum + pointsByQuestion[questionId],
      0
    );
    const categoryMin = questionIds.reduce(
      (sum, questionId) => sum + QUESTION_RANGES[questionId].min,
      0
    );
    const categoryMax = questionIds.reduce(
      (sum, questionId) => sum + QUESTION_RANGES[questionId].max,
      0
    );
    categories[category] = Math.round(
      ((categoryPoints - categoryMin) / (categoryMax - categoryMin)) * 100
    );
  }
  categories.aware = 100 - Math.round(normalizedRisk * 100);

  return {
    score,
    maxScore: 84,
    label: getLabel(score),
    level: getLevel(score),
    categories
  };
}

function purchaseIsUsable(purchase) {
  if (!purchase || typeof purchase !== 'object') return false;
  if (purchase.refunded === true || purchase.refunded === 'true') return false;
  if (purchase.chargebacked === true || purchase.chargebacked === 'true') return false;
  if (purchase.disputed === true || purchase.disputed === 'true') return false;
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      ...jsonResponse(405, { verified: false, error: 'Method not allowed.' }),
      headers: {
        ...jsonResponse(405, {}).headers,
        Allow: 'POST'
      }
    };
  }

  const productId = process.env.GUMROAD_PRODUCT_ID;
  if (!productId) {
    return jsonResponse(503, {
      verified: false,
      error: 'Checkout verification is not configured yet.'
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { verified: false, error: 'Invalid request.' });
  }

  const licenseKey = typeof body.license_key === 'string' ? body.license_key.trim() : '';
  if (licenseKey.length < 8 || licenseKey.length > 200) {
    return jsonResponse(400, {
      verified: false,
      error: 'Enter the license key from your Gumroad receipt.'
    });
  }

  let result;
  try {
    result = scoreAnswers(body.answers);
  } catch (error) {
    return jsonResponse(400, { verified: false, error: error.message });
  }

  try {
    const form = new URLSearchParams({
      product_id: productId,
      license_key: licenseKey,
      increment_uses_count: 'false'
    });

    const response = await fetch(GUMROAD_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    const gumroad = await response.json().catch(() => ({}));

    if (!response.ok || gumroad.success !== true || !purchaseIsUsable(gumroad.purchase)) {
      return jsonResponse(402, {
        verified: false,
        error: 'That purchase could not be verified. Check the key and try again.'
      });
    }

    return jsonResponse(200, { verified: true, result });
  } catch (error) {
    console.error('Gumroad verification error:', error);
    return jsonResponse(502, {
      verified: false,
      error: 'Gumroad verification is temporarily unavailable. Please try again.'
    });
  }
};

exports.scoreAnswers = scoreAnswers;
exports.sanitizeAnswers = sanitizeAnswers;
