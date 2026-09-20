import { Question } from '../types';

export interface YouTubeReference {
  videoTitle: string;
  channelName: string;
  searchUrl: string;
  directUrl: string;
  embedUrl: string;
  topicKeyword: string;
  relevanceExplanation: string;
}

// Curated educational video references mapped by question ID and concept ID
const CURATED_YOUTUBE_RESOURCES: Record<
  string,
  {
    videoId: string;
    videoTitle: string;
    channelName: string;
    topicKeyword: string;
    relevanceExplanation: string;
  }
> = {
  // Quadratic Equations & Roots - Q1
  'q-math-3-1': {
    videoId: 'i7idZfS8t8w',
    videoTitle: 'How to Use the Quadratic Formula & Understand the Discriminant',
    channelName: 'Khan Academy',
    topicKeyword: 'Quadratic Formula & Discriminant Roots',
    relevanceExplanation:
      'Step-by-step walkthrough of b² - 4ac, showing why positive discriminant guarantees two distinct real roots.',
  },
  // Quadratic Equations & Roots - Q2
  'q-math-3-2': {
    videoId: 'J8n-u29P3V4',
    videoTitle: 'What Discriminant = 0 Means on a Parabolic Graph',
    channelName: 'Brian McLogan',
    topicKeyword: 'Discriminant Zero Tangent Vertex',
    relevanceExplanation:
      'Visualizes how the vertex touches the x-axis tangentially when ±√0 yields exactly one repeated real root.',
  },
  // Quadratic Equations & Roots - Q3
  'q-math-3-3': {
    videoId: '2V6cR7e29-Y',
    videoTitle: 'Quadratic Projectile Motion & Parabolic Word Problems',
    channelName: 'The Organic Chemistry Tutor',
    topicKeyword: 'Height h(t) Trajectory Roots',
    relevanceExplanation:
      'Demonstrates factoring -5t(t - 4) = 0 to calculate projectile launch (t=0) and ground contact (t=4).',
  },
  // Newton's Laws & Friction - Q1
  'q-phy-2-1': {
    videoId: 'fo_pmp5rtIA',
    videoTitle: 'Static vs Kinetic Friction Force on an Object',
    channelName: 'Khan Academy Physics',
    topicKeyword: 'Static Friction Threshold & Acceleration',
    relevanceExplanation:
      'Explains why applied force under the maximum static threshold results in zero acceleration (a = 0 m/s²).',
  },
  // Loops & Iteration - Q1
  'q-cs-3-1': {
    videoId: '8zC16m8o2gU',
    videoTitle: 'For Loops: Break vs Continue Explained with Output Examples',
    channelName: 'Bro Code',
    topicKeyword: 'Continue Statement Loop Skipping',
    relevanceExplanation:
      'Shows how continue skips the i == 3 iteration while continuing the loop for i=4, producing a total of 7.',
  },
  // Diagnostic Q1: Slope
  'diag-1': {
    videoId: 'ADLoXbZqVdQ',
    videoTitle: 'Intro to Slope: Rise Over Run & Slope Formula',
    channelName: 'Khan Academy',
    topicKeyword: 'Slope Formula m = (y2 - y1)/(x2 - x1)',
    relevanceExplanation:
      'Guides through calculating the rate of change m = 2 between coordinate pairs (2,3) and (6,11).',
  },
  // Diagnostic Q2: Difference of squares
  'diag-2': {
    videoId: '_qyV4F4e9hA',
    videoTitle: 'Difference of Squares Identity (x - a)(x + a)',
    channelName: 'Khan Academy',
    topicKeyword: 'Algebraic Identities Difference of Squares',
    relevanceExplanation:
      'Shows how cross-multiplied middle terms cancel out to leave x² - 25 without linear coefficients.',
  },
  // Diagnostic Q3: Vectors
  'diag-3': {
    videoId: 'b7mN19q4q-Q',
    videoTitle: '2D Displacement & Perpendicular Vector Addition',
    channelName: 'Khan Academy Physics',
    topicKeyword: 'Pythagorean Vector Displacement',
    relevanceExplanation:
      'Demonstrates the 30-40-50 right triangle displacement magnitude using the Pythagorean theorem.',
  },
  // Diagnostic Q4: Boolean Logic
  'diag-4': {
    videoId: 'gI-qXk7XojA',
    videoTitle: 'Boolean Logic & Logic Gates Explained',
    channelName: 'CrashCourse Computer Science',
    topicKeyword: 'Boolean AND & NOT Inversion',
    relevanceExplanation:
      'Breaks down why !(true && false) evaluates to !(false), which yields true.',
  },
};

/**
 * Returns a rich YouTube reference for any question, whether curated or dynamically formulated.
 */
export function getYouTubeReferenceForQuestion(
  question: Question,
  selectedWrongAnswer?: string
): YouTubeReference {
  const curated = CURATED_YOUTUBE_RESOURCES[question.id];

  // Clean targeted search query based on question and concepts
  const cleanQText = question.text
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .slice(0, 80);

  const correctAnswer = question.options[question.correctIndex];
  const searchTerms = `${question.conceptTitle} ${cleanQText} ${correctAnswer} tutorial Khan Academy`;
  const encodedSearch = encodeURIComponent(searchTerms);
  const searchUrl = `https://www.youtube.com/results?search_query=${encodedSearch}`;

  if (curated) {
    return {
      videoTitle: curated.videoTitle,
      channelName: curated.channelName,
      searchUrl,
      directUrl: `https://www.youtube.com/watch?v=${curated.videoId}`,
      embedUrl: `https://www.youtube.com/embed/${curated.videoId}?autoplay=0&rel=0`,
      topicKeyword: curated.topicKeyword,
      relevanceExplanation: curated.relevanceExplanation,
    };
  }

  // Fallback for dynamically generated or untracked questions
  return {
    videoTitle: `${question.conceptTitle} - Video Explanation & Walkthrough`,
    channelName: 'YouTube Education',
    searchUrl,
    directUrl: searchUrl,
    embedUrl: `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(question.conceptTitle + ' tutorial')}`,
    topicKeyword: question.conceptTitle,
    relevanceExplanation: `Curated video lessons covering "${question.conceptTitle}" focusing on the principle: "${correctAnswer}".`,
  };
}

/**
 * Safe trigger to open YouTube in a new tab or window.
 * Handled gracefully if popup blockers intervene.
 */
export function openYouTubeReference(url: string): boolean {
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win) {
      win.focus();
      return true;
    }
  } catch (err) {
    console.warn('Could not open YouTube via window.open:', err);
  }
  return false;
}
