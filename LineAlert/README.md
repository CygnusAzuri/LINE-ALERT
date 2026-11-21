# ⚡ LINE ALERT

> **Project Tagline:** *Know when it's actually your turn, without standing there.*  
> **Course:** Mobile Computing Group Project  
> **Architecture:** Pure HTML5, CSS3 / Bootstrap 5, JavaScript (ES6+), Firebase Firestore & Firebase Hosting.

---

## 📱 About LINE ALERT

LINE ALERT is a mobile-first virtual queue management solution designed for college canteens, clinics, and service counters. Customers join a physical queue simply by scanning a QR code on their smartphone. They can walk around freely, study, or sit comfortably while tracking their queue position in real-time. When their turn is approaching (2–3 people ahead), LINE ALERT notifies them via browser notifications, synthesized audio chimes, and mobile device vibration.

---

## 🗂️ Project Directory Structure

```text
LINE-ALERT/
│
├── index.html                  # Landing page with counter QR code & navigation
├── customer.html               # Mobile customer queue interface & live position tracker
├── admin.html                  # Counter operator dashboard (Call Next, Served, Skip)
├── test-integration.html       # Member 4 test workbench for Firebase & notifications
│
├── css/
│   └── style.css               # Responsive mobile-first stylesheet & design tokens
│
├── js/
│   ├── firebase-config.js      # Firebase SDK initialization & Firestore collections
│   ├── notification.js         # Web Notification API, Web Audio synthesizer & vibration
│   ├── queue.js                # Core queue operations & Firestore transactions
│   ├── customer.js             # Customer interface controller & position tracking
│   ├── admin.js                # Counter operator controller & live stream
│   └── qr.js                   # Dynamic QR code generator helper
│
├── assets/
│   ├── logo.svg                # Vector brand logo
│   ├── logo.png                # Brand icon asset
│   └── qr-code.png             # Sample QR asset
│
├── firebase.json               # Firebase Hosting configuration
├── firestore.rules             # Firestore security rules
├── .firebaserc                 # Firebase project alias
├── INTEGRATION_GUIDE.md        # Alignment contracts & API specs for all 4 team members
├── MEMBER4_REPORT.md           # Member 4 individual academic project documentation
└── README.md                   # This project manual
```

---

## 🚀 Quickstart Guide

### 1. Configure Firebase (One-Time Setup)
1. Visit the [Firebase Console](https://console.firebase.google.com/) and create a project (e.g., `line-alert-canteen`).
2. Navigate to **Firestore Database** and click **Create Database** (Select *Start in test mode*).
3. Add a **Web App** (`</>`) in Project Settings and copy your `firebaseConfig` keys.
4. Open `js/firebase-config.js` and paste your keys into the `firebaseConfig` object:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "line-alert-canteen.firebaseapp.com",
     projectId: "line-alert-canteen",
     storageBucket: "line-alert-canteen.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

### 2. Test Locally (Member 4 Workbench)
Simply open `test-integration.html` in your web browser:
- Check connection health status.
- Click **Initialize CANTEEN01 Counter**.
- Test audio chimes and mobile vibration.
- Simulate customer additions and watch the real-time queue feed update instantly!

### 3. Deploy to Firebase Hosting
```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login to Google
firebase login

# 3. Deploy Hosting and Rules
firebase deploy
```

---

## 👥 Team Work Distribution (4 Members)

| Member | Module | Deliverables |
| :--- | :--- | :--- |
| **Member 1** | Frontend & UI | `index.html`, `customer.html`, `admin.html`, `css/style.css` |
| **Member 2** | Queue Management | `js/queue.js`, `js/admin.js`, queue generation & admin controls |
| **Member 3** | QR Code & Customer Module | `js/qr.js`, `js/customer.js`, joining/leaving queue flow |
| **Member 4** | Database, Notifications & Deployment | `js/firebase-config.js`, `js/notification.js`, `firebase.json`, `test-integration.html`, integration guide |

---

## 📄 Team Collaboration Contract
Before modifying code, please consult [INTEGRATION_GUIDE.md](file:///c:/Users/gupta/Downloads/LineAlert/INTEGRATION_GUIDE.md) to ensure consistency in DOM IDs, Firestore fields, and function signatures.
