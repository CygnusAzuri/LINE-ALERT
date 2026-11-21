# LINE ALERT — Member 2 Report
## Queue Management Module

**Project:** LINE ALERT — Smart Queue Management System  
**Team Member:** Vanshika (Member 2)  
**Assigned Role:** Member 2 — Queue Management (Core Logic)  
**Development Branch:** `member2-queue-logic`  
**Repository:** https://github.com/CygnusAzuri/LINE-ALERT

---

## 1. Module Overview

Member 2 is responsible for the **core queue logic** of LINE ALERT — the engine that powers every queue operation from token creation to admin controls.

The module sits between the Firebase database (Member 4) and the user-facing interfaces (Members 1 and 3). It is designed so that **Member 3's customer page** and **Member 2's admin page** both call the same shared `LineAlertQueue` API, guaranteeing consistent behavior.

---

## 2. Technology Stack

| Technology | Purpose |
|---|---|
| JavaScript (ES2017+) | Queue logic, async/await operations |
| Firebase Firestore | Real-time database reads/writes |
| Firestore Transactions | Atomic sequential token generation |
| Firestore Batch Writes | Atomic multi-document admin operations |
| `localStorage` | Served count persistence across page refreshes |
| Bootstrap 5 | Admin table and button styling |

---

## 3. Files Owned by Member 2

```
LineAlert/
├── js/
│   ├── queue.js    ← Core queue API (primary deliverable)
│   └── admin.js    ← Admin dashboard controller
```

---

## 4. Key Design Decisions

### 4.1 Sequential Token Generation via Firestore Transaction

**Problem:** The original placeholder used `Math.random()`, which could produce duplicate tokens if two customers joined at the same time.

**Solution:** Tokens are now generated using a **Firestore transaction** that atomically reads and increments a `nextTokenNumber` field on the counter document.

```
Customer A joins → transaction reads nextTokenNumber = 101, writes 102 → gets "A101"
Customer B joins → transaction reads nextTokenNumber = 102, writes 103 → gets "A102"
```

Even if both join simultaneously, Firestore's transaction guarantees they get different numbers. Tokens restart from A101 when the admin resets the queue.

### 4.2 Dynamic Position Calculation (Never Stored)

Queue position is **not stored** as a field in Firestore. It is always **calculated on the fly** from the live active queue ordered by `createdAt`.

```javascript
// calculatePosition() fetches all waiting + serving entries, ordered by createdAt,
// and counts how many appear before the customer's entry.
const { position, peopleAhead, status } = await LineAlertQueue.calculatePosition(tokenId, counterId);
```

This means skipped or cancelled customers automatically disappear from position calculations — no manual recalculation needed.

### 4.3 Atomic Batch Writes for Admin Operations

All admin actions that touch multiple documents (e.g., `callNextCustomer` must simultaneously promote the next customer AND complete the previous one AND update the counter) use **Firestore batch writes**. This ensures the database never enters an inconsistent state.

### 4.4 Served Count Persistence

The admin's "Served Today" count is stored in `localStorage` with a counter-specific key:
```
Key: linealert_served_count_CANTEEN01
```
This survives page refreshes (the admin can close and reopen the tab). It resets to 0 when the queue is reset.

---

## 5. `LineAlertQueue` API Reference

All functions are exposed on `window.LineAlertQueue` for use across all pages.

### Customer-Side Functions

| Function | Description |
|---|---|
| `addCustomerToQueue(counterId, customerName)` | Generates sequential token, writes customer to Firestore, returns `{id, tokenId, status, ...}` |
| `leaveQueue(queueDocId)` | Soft-cancels the customer's entry (sets `status: 'cancelled'`) |
| `calculatePosition(tokenId, counterId)` | Dynamically calculates `{position, peopleAhead, status}` with one Firestore read |
| `getCustomerStatus(queueDocId)` | Fetches latest document data by doc ID |
| `estimateWaitMinutes(peopleAhead, avgServiceMins)` | Returns human-readable wait string (`"9m"`, `"Now!"`, `"< 1m"`) |

### Admin-Side Functions

| Function | Description |
|---|---|
| `callNextCustomer(counterId)` | Promotes oldest waiting → serving; completes previous serving. Batch write. Returns called customer. |
| `markCurrentAsServed(counterId)` | Marks serving customer as completed. Resets counter display. |
| `skipCurrentCustomer(counterId)` | Marks serving customer as skipped. Resets counter display. |
| `resetQueue(counterId)` | Deletes all queue entries. Resets `nextTokenNumber` to 100. |

### Real-Time Listeners

| Function | Description |
|---|---|
| `subscribeToCounter(counterId, callback)` | Live stream of counter document (Now Serving token). Returns unsubscribe fn. |
| `subscribeToActiveQueue(counterId, callback)` | Live stream of `waiting + serving` entries ordered by `createdAt`. Returns unsubscribe fn. |

---

## 6. Data Contract (Agreed with Member 4)

### Collection: `counters` — Document: `CANTEEN01`

| Field | Type | Description |
|---|---|---|
| `counterId` | string | `"CANTEEN01"` |
| `counterName` | string | `"College Canteen Counter 1"` |
| `currentToken` | string | Token currently serving, e.g. `"A103"` or `"---"` |
| `currentCustomerName` | string | Name of customer at counter |
| `isActive` | boolean | `true` while counter is operating |
| `nextTokenNumber` | number | Sequential counter for token generation (e.g. `103`) |
| `updatedAt` | timestamp | Last modified time |

### Collection: `queues` — Auto-ID Documents

| Field | Type | Values |
|---|---|---|
| `tokenId` | string | `"A101"`, `"A102"`, ... |
| `counterId` | string | `"CANTEEN01"` |
| `customerName` | string | Customer's entered name |
| `status` | string | `waiting` / `serving` / `completed` / `skipped` / `cancelled` |
| `createdAt` | timestamp | Queue ordering key |
| `servedAt` | timestamp | When admin called this token |
| `completedAt` | timestamp | When marked served |
| `cancelledAt` | timestamp | When customer left |
| `skippedAt` | timestamp | When admin skipped |

---

## 7. Admin Dashboard Features

The admin interface (`admin.html` + `admin.js`) provides:

- **Live "Currently Serving" display** — updates in real time via Firestore listener
- **Live waiting queue table** — auto-refreshes as customers join or leave
  - Next-in-line is highlighted in blue (`table-primary`)
  - Estimated wait shown per customer using `estimateWaitMinutes()`
- **Call Next Customer** — one click advances the queue
- **Mark Served** — closes the current service session
- **Skip** — removes a no-show customer
- **Reset Queue** — clears everything, restarts from A101
- **Served Today counter** — persists across page refreshes via localStorage
- All buttons disable during async operations to prevent double-clicks

---

## 8. Integration with Other Members

### How Member 3 (Customer Module) uses Member 2's code

```javascript
// Join queue — Member 3's customer.js calls this
const entry = await LineAlertQueue.addCustomerToQueue(counterId, name);
// entry = { id: "abc", tokenId: "A103", status: "waiting", ... }

// Real-time position tracking
LineAlertQueue.subscribeToActiveQueue(counterId, (items) => {
  const userItem = items.find(i => i.tokenId === currentTokenId);
  const peopleAhead = items.filter(i => i.status === 'waiting').indexOf(userItem);
  const estWait = LineAlertQueue.estimateWaitMinutes(peopleAhead); // ← Member 2 helper
});

// Leave queue
await LineAlertQueue.leaveQueue(currentQueueDocId);
```

### How Member 4 (Firebase) enables Member 2's code

Member 2 accesses Firestore through `window.LineAlertFirebase.db` and uses the constants:
- `window.LineAlertFirebase.COLLECTIONS.QUEUES`
- `window.LineAlertFirebase.COLLECTIONS.COUNTERS`
- `window.LineAlertFirebase.QUEUE_STATUS.*`
- `window.LineAlertFirebase.DEFAULT_COUNTER_ID`

---

## 9. Testing

| Test Case | Expected Result | Status |
|---|---|---|
| Join queue — first customer | Gets token A101 | ✅ Locally verified |
| Join queue — second customer | Gets token A102 (not random) | ✅ Locally verified |
| Leave queue | Status → `cancelled`, removed from active list | ✅ Locally verified |
| Call Next | Oldest waiting → `serving`; previous serving → `completed` | ✅ Locally verified |
| Mark Served | Serving customer → `completed`; counter resets | ✅ Locally verified |
| Skip | Serving customer → `skipped`; counter resets | ✅ Locally verified |
| Reset Queue | All entries deleted; nextTokenNumber reset | ✅ Locally verified |
| estimateWaitMinutes(0) | Returns `"Now!"` | ✅ Verified |
| estimateWaitMinutes(3) | Returns `"9m"` | ✅ Verified |
| Served count persists on refresh | Same number after reload | ✅ Locally verified |
| Concurrent joins (simulation) | No duplicate tokens | ✅ Transaction logic verified |
| Real-time queue update | Table refreshes without page reload | Pending Firebase live test |

---

## 10. Development Log

| Phase | Work Performed | Status |
|---|---|---|
| 1 | Reviewed project spec and Members 3 & 4 integration documents | ✅ Complete |
| 2 | Analysed existing queue.js placeholder from Member 4 | ✅ Complete |
| 3 | Designed sequential token generation with Firestore transaction | ✅ Complete |
| 4 | Implemented full `queue.js` with all API functions and real-time listeners | ✅ Complete |
| 5 | Added `calculatePosition()`, `getCustomerStatus()`, `estimateWaitMinutes()` helpers | ✅ Complete |
| 6 | Implemented `admin.js` with live table, served count persistence, button handlers | ✅ Complete |
| 7 | Coordinated with Member 3 — updated `customer.js` to use `estimateWaitMinutes()` | ✅ Complete |
| 8 | Authored this Member 2 report | ✅ Complete |
| 9 | Firebase live integration testing | Pending |
| 10 | Final demo and deployment | Pending |

---

## 11. Problems Encountered and Solutions

| Problem | Solution |
|---|---|
| Random tokens could duplicate under concurrent joins | Used Firestore **transaction** to atomically read-and-increment `nextTokenNumber` |
| Served count resetting on every page refresh | Stored count in `localStorage` with counter-specific key |
| Admin could double-click buttons causing duplicate Firestore writes | Disabled button during async operation; re-enabled in `finally` block |
| `alert()` broke the mobile user experience | Replaced all `alert()` with `window.notifier.showInAppToast()` |
| Position calculation needed to ignore cancelled/completed entries | Filter to `status === 'waiting' \|\| status === 'serving'` before calculating index |

---

*Member 2 — Queue Management Module — LINE ALERT 2026*
