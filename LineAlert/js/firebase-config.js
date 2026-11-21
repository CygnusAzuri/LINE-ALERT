/**
 * LINE ALERT - Firebase Configuration & Initialization
 * Module: Member 4 (Notifications, Database & Deployment)
 * 
 * Instructions:
 * 1. Go to Firebase Console (https://console.firebase.google.com/)
 * 2. Create a new project (e.g., "line-alert-canteen")
 * 3. Add a Web App (</>) and copy your firebaseConfig object.
 * 4. Paste your configuration values in the firebaseConfig object below.
 * 5. In Firebase Console -> Firestore Database, click "Create database" (Start in test mode).
 */

const firebaseConfig = {
  apiKey: "AIzaSyAWRtE__WyrOpm_uNXxKPPnGK96TzJXcIY",
  authDomain: "line-alert-canteen.firebaseapp.com",
  databaseURL: "https://line-alert-canteen-default-rtdb.firebaseio.com",
  projectId: "line-alert-canteen",
  storageBucket: "line-alert-canteen.firebasestorage.app",
  messagingSenderId: "207568694762",
  appId: "1:207568694762:web:06ba2f479cef0a0e821693",
  measurementId: "G-9TMHYNS7RL"
};

// Check if credentials have been replaced
const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

// Initialize Firebase
if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    try {
      firebase.initializeApp(firebaseConfig);
      console.log("✅ [LineAlert] Firebase initialized successfully.");
    } catch (e) {
      console.error("❌ [LineAlert] Error initializing Firebase:", e);
    }
  }
} else {
  console.warn("⚠️ [LineAlert] Firebase SDK not loaded yet. Ensure firebase-app-compat.js script is included.");
}

// Global Firestore Reference
const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;

// Standard Collection Names (Used across all modules)
const COLLECTIONS = {
  COUNTERS: 'counters',
  QUEUES: 'queues'
};

// Standard Queue Statuses (Used across all modules)
const QUEUE_STATUS = {
  WAITING: 'waiting',      // Customer joined, waiting in queue
  SERVING: 'serving',      // Admin called this token; currently at counter
  COMPLETED: 'completed',  // Service finished; customer served
  SKIPPED: 'skipped',      // Customer did not show up
  CANCELLED: 'cancelled'   // Customer voluntarily left the queue
};

// Default Counter ID for single-counter MVP
const DEFAULT_COUNTER_ID = 'CANTEEN01';
const DEFAULT_COUNTER_NAME = 'College Canteen Counter 1';

// Helper: Check if Firebase is ready and configured
async function checkFirebaseConnection() {
  if (!isConfigured) {
    return {
      connected: false,
      message: "Firebase credentials not configured. Please edit js/firebase-config.js with your project keys."
    };
  }
  if (!db) {
    return {
      connected: false,
      message: "Firestore SDK is not initialized."
    };
  }
  try {
    // Attempt a lightweight read from 'counters' collection
    await db.collection(COLLECTIONS.COUNTERS).limit(1).get();
    return {
      connected: true,
      message: "Connected to Firebase Firestore successfully!"
    };
  } catch (error) {
    return {
      connected: false,
      message: "Connection failed: " + error.message
    };
  }
}

// Export for browser window
window.LineAlertFirebase = {
  config: firebaseConfig,
  isConfigured: isConfigured,
  db: db,
  COLLECTIONS: COLLECTIONS,
  QUEUE_STATUS: QUEUE_STATUS,
  DEFAULT_COUNTER_ID: DEFAULT_COUNTER_ID,
  DEFAULT_COUNTER_NAME: DEFAULT_COUNTER_NAME,
  checkConnection: checkFirebaseConnection
};
