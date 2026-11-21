/**
 * LINE ALERT - Queue Management Core Logic
 * Module: Member 2 (Queue Management)
 * Author: Vanshika (Member 2)
 * Branch: member2-queue-logic
 *
 * Responsibilities:
 *   - Sequential token generation (A101, A102, ... via Firestore counter)
 *   - Add customers to queue (addCustomerToQueue)
 *   - Remove/cancel customers from queue (leaveQueue)
 *   - Admin controls: callNextCustomer, markCurrentAsServed, skipCurrentCustomer, resetQueue
 *   - Position calculation helpers: calculatePosition, getCustomerStatus
 *   - Estimated wait time calculation: estimateWaitMinutes
 *   - Realtime listeners: subscribeToCounter, subscribeToActiveQueue
 *
 * Integration:
 *   - Depends on window.LineAlertFirebase (firebase-config.js — Member 4)
 *   - Consumed by customer.js (Member 3) and admin.js (Member 2)
 *   - Exposes window.LineAlertQueue for all pages
 */

const LineAlertQueue = {

  // ─────────────────────────────────────────────────────────────
  // TOKEN GENERATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Generates the NEXT sequential token for a counter.
   * Reads and atomically increments the counter's `nextTokenNumber` field
   * using a Firestore transaction, guaranteeing uniqueness even when multiple
   * customers join simultaneously.
   *
   * Token format: "A" + 3-digit number (e.g. A101, A102 … A999)
   *
   * @param {string} counterId
   * @returns {Promise<string>} The newly allocated token string (e.g. "A103")
   */
  async generateNextToken(counterId) {
    const db = window.LineAlertFirebase.db;
    if (!db) throw new Error("Firestore not initialized.");

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;
    const counterRef = db.collection(window.LineAlertFirebase.COLLECTIONS.COUNTERS).doc(targetCounterId);

    // Run inside a transaction so concurrent joins never get the same number
    const newTokenNumber = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let nextNumber = 101; // Start at A101 for a fresh counter

      if (counterDoc.exists) {
        const data = counterDoc.data();
        // Increment from wherever we left off
        if (typeof data.nextTokenNumber === 'number' && data.nextTokenNumber >= 101) {
          nextNumber = data.nextTokenNumber + 1;
        }
      }

      // Write the new nextTokenNumber back
      transaction.set(counterRef, { nextTokenNumber: nextNumber }, { merge: true });

      return nextNumber;
    });

    return `A${newTokenNumber}`;
  },

  // ─────────────────────────────────────────────────────────────
  // CUSTOMER OPERATIONS
  // ─────────────────────────────────────────────────────────────

  /**
   * Adds a customer to the Firestore queue.
   * Calls generateNextToken() to get a guaranteed sequential, unique token.
   *
   * @param {string} counterId     - The counter to join (e.g. "CANTEEN01")
   * @param {string} customerName  - The customer's name
   * @returns {Promise<object>}    - The new Firestore document data + its auto-generated id
   *
   * Example response:
   *   { id: "abc123", tokenId: "A103", counterId: "CANTEEN01",
   *     customerName: "Sakshi", status: "waiting", createdAt: ... }
   */
  async addCustomerToQueue(counterId, customerName) {
    const db = window.LineAlertFirebase.db;
    if (!db) throw new Error("Firestore not initialized.");
    if (!customerName || !customerName.trim()) throw new Error("Customer name is required.");

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;

    // Generate a sequential token (safe for concurrent joins)
    const tokenId = await this.generateNextToken(targetCounterId);

    const queueData = {
      tokenId:      tokenId,
      counterId:    targetCounterId,
      customerName: customerName.trim(),
      status:       window.LineAlertFirebase.QUEUE_STATUS.WAITING,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES).add(queueData);

    console.log(`[LineAlertQueue] Customer "${customerName}" joined with token ${tokenId} (doc: ${docRef.id})`);
    return { id: docRef.id, ...queueData };
  },

  /**
   * Cancels a customer's queue entry when they choose to leave.
   * Sets status to 'cancelled' (soft delete — preserves audit trail).
   *
   * @param {string} queueDocId  - Firestore document ID of the customer's queue entry
   * @returns {Promise<void>}
   */
  async leaveQueue(queueDocId) {
    const db = window.LineAlertFirebase.db;
    if (!db)         throw new Error("Firestore not initialized.");
    if (!queueDocId) throw new Error("Queue document ID is required to leave the queue.");

    await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .doc(queueDocId)
      .update({
        status:      window.LineAlertFirebase.QUEUE_STATUS.CANCELLED,
        cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    console.log(`[LineAlertQueue] Customer left queue (doc: ${queueDocId}).`);
  },

  // ─────────────────────────────────────────────────────────────
  // POSITION CALCULATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Calculates a customer's current position in the waiting queue.
   * Position is derived DYNAMICALLY from active Firestore data, never stored.
   *
   * - Position 1 means you are NEXT in line (one person ahead of you: the person currently serving).
   * - Position 0 means you are being served right now.
   *
   * @param {string} tokenId   - The customer's token (e.g. "A103")
   * @param {string} counterId - The counter ID
   * @returns {Promise<{position: number, peopleAhead: number, status: string}>}
   */
  async calculatePosition(tokenId, counterId) {
    const db = window.LineAlertFirebase.db;
    if (!db) throw new Error("Firestore not initialized.");

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;

    // Fetch all active (waiting + serving) entries without composite index requirement
    const snapshot = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .where('status', 'in', [
        window.LineAlertFirebase.QUEUE_STATUS.WAITING,
        window.LineAlertFirebase.QUEUE_STATUS.SERVING
      ])
      .get();

    const activeItems = [];
    snapshot.forEach(doc => activeItems.push({ id: doc.id, ...doc.data() }));

    // In-memory sort by createdAt (oldest first, zero index needed)
    activeItems.sort((a, b) => {
      const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (new Date(a.createdAt).getTime() || 0));
      const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (new Date(b.createdAt).getTime() || 0));
      return tA - tB;
    });

    // Find the customer's document
    const customerItem = activeItems.find(item => item.tokenId === tokenId);
    if (!customerItem) {
      // Token is no longer in active queue (served, cancelled, skipped)
      return { position: -1, peopleAhead: -1, status: 'inactive' };
    }

    if (customerItem.status === window.LineAlertFirebase.QUEUE_STATUS.SERVING) {
      return { position: 0, peopleAhead: 0, status: 'serving' };
    }

    // Count how many WAITING entries come before this customer (by createdAt order)
    const waitingOnly = activeItems.filter(i => i.status === window.LineAlertFirebase.QUEUE_STATUS.WAITING);
    const indexInWaiting = waitingOnly.findIndex(i => i.tokenId === tokenId);
    const peopleAhead = indexInWaiting >= 0 ? indexInWaiting : 0;

    return {
      position:    indexInWaiting + 1,  // 1-based position in queue
      peopleAhead: peopleAhead,
      status:      'waiting'
    };
  },

  /**
   * Fetches the latest status of a specific customer's queue entry by document ID.
   * Used for one-shot status checks (not real-time).
   *
   * @param {string} queueDocId - Firestore document ID
   * @returns {Promise<object|null>} Document data or null if not found
   */
  async getCustomerStatus(queueDocId) {
    const db = window.LineAlertFirebase.db;
    if (!db || !queueDocId) return null;

    const doc = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES).doc(queueDocId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },

  // ─────────────────────────────────────────────────────────────
  // WAIT TIME ESTIMATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Estimates the waiting time in minutes based on queue position.
   * Uses an average service time of 3 minutes per customer (adjustable).
   *
   * @param {number} peopleAhead        - Number of customers ahead
   * @param {number} [avgServiceMins=3] - Average service time per customer
   * @returns {string} Human-readable estimate (e.g. "9m", "Now!", "< 1m")
   */
  estimateWaitMinutes(peopleAhead, avgServiceMins = 3) {
    if (peopleAhead <= 0) return 'Now!';
    const totalMins = peopleAhead * avgServiceMins;
    if (totalMins < 1) return '< 1m';
    return `${totalMins}m`;
  },

  // ─────────────────────────────────────────────────────────────
  // ADMIN CONTROLS
  // ─────────────────────────────────────────────────────────────

  /**
   * Admin: Call the next waiting customer.
   * - Marks the oldest 'waiting' entry as 'serving'.
   * - Marks any currently 'serving' entry as 'completed' first.
   * - Updates the counter's currentToken and currentCustomerName fields.
   * All writes are batched — either all succeed or all fail.
   *
   * @param {string} counterId
   * @returns {Promise<object|null>} The called customer's data, or null if queue is empty
   */
  async callNextCustomer(counterId) {
    const db = window.LineAlertFirebase.db;
    if (!db) throw new Error("Firestore not initialized.");

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;

    // Find all waiting customers (in-memory sort avoids composite index requirement)
    const waitingSnapshot = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .where('status', '==', window.LineAlertFirebase.QUEUE_STATUS.WAITING)
      .get();

    if (waitingSnapshot.empty) {
      console.log('[LineAlertQueue] No waiting customers — queue is empty.');
      return null;
    }

    const waitingDocs = [];
    waitingSnapshot.forEach(doc => waitingDocs.push({ docRef: doc.ref, id: doc.id, data: doc.data() }));

    // In-memory sort by createdAt ascending (oldest customer first)
    waitingDocs.sort((a, b) => {
      const tA = a.data.createdAt?.toMillis ? a.data.createdAt.toMillis() : (a.data.createdAt?.seconds ? a.data.createdAt.seconds * 1000 : (new Date(a.data.createdAt).getTime() || 0));
      const tB = b.data.createdAt?.toMillis ? b.data.createdAt.toMillis() : (b.data.createdAt?.seconds ? b.data.createdAt.seconds * 1000 : (new Date(b.data.createdAt).getTime() || 0));
      return tA - tB;
    });

    const nextDoc  = waitingDocs[0].docRef;
    const nextData = waitingDocs[0].data;

    // Find any currently serving customer(s) to complete them first
    const currentServingSnapshot = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .where('status', '==', window.LineAlertFirebase.QUEUE_STATUS.SERVING)
      .get();

    const batch = db.batch();

    // Complete previous serving customer(s)
    currentServingSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        status:      window.LineAlertFirebase.QUEUE_STATUS.COMPLETED,
        completedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    // Promote next waiting customer to serving
    batch.update(nextDoc.ref, {
      status:   window.LineAlertFirebase.QUEUE_STATUS.SERVING,
      servedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update the counter document so customer.html can display "Now Serving"
    const counterRef = db.collection(window.LineAlertFirebase.COLLECTIONS.COUNTERS).doc(targetCounterId);
    batch.update(counterRef, {
      currentToken:        nextData.tokenId,
      currentCustomerName: nextData.customerName,
      updatedAt:           firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    console.log(`[LineAlertQueue] Called token ${nextData.tokenId} (${nextData.customerName}).`);
    return { id: nextDoc.id, ...nextData };
  },

  /**
   * Admin: Mark the currently serving customer as completed (served).
   * Resets the counter's currentToken to '---'.
   *
   * @param {string} counterId
   * @returns {Promise<void>}
   */
  async markCurrentAsServed(counterId) {
    const db = window.LineAlertFirebase.db;
    if (!db) throw new Error("Firestore not initialized.");

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;

    const servingSnapshot = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .where('status', '==', window.LineAlertFirebase.QUEUE_STATUS.SERVING)
      .get();

    if (servingSnapshot.empty) {
      console.log('[LineAlertQueue] No customer currently being served.');
      return;
    }

    const batch = db.batch();

    servingSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        status:      window.LineAlertFirebase.QUEUE_STATUS.COMPLETED,
        completedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    // Reset counter display
    const counterRef = db.collection(window.LineAlertFirebase.COLLECTIONS.COUNTERS).doc(targetCounterId);
    batch.update(counterRef, {
      currentToken:        '---',
      currentCustomerName: '',
      updatedAt:           firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    console.log('[LineAlertQueue] Current customer marked as served.');
  },

  /**
   * Admin: Skip the currently serving customer (they did not show up).
   * Sets status to 'skipped' and resets the counter.
   *
   * @param {string} counterId
   * @returns {Promise<void>}
   */
  async skipCurrentCustomer(counterId) {
    const db = window.LineAlertFirebase.db;
    if (!db) throw new Error("Firestore not initialized.");

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;

    const servingSnapshot = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .where('status', '==', window.LineAlertFirebase.QUEUE_STATUS.SERVING)
      .get();

    if (servingSnapshot.empty) {
      console.log('[LineAlertQueue] No customer currently being served — nothing to skip.');
      return;
    }

    const batch = db.batch();

    servingSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        status:    window.LineAlertFirebase.QUEUE_STATUS.SKIPPED,
        skippedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    const counterRef = db.collection(window.LineAlertFirebase.COLLECTIONS.COUNTERS).doc(targetCounterId);
    batch.update(counterRef, {
      currentToken:        '---',
      currentCustomerName: '',
      updatedAt:           firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    console.log('[LineAlertQueue] Current customer skipped.');
  },

  /**
   * Admin: Reset the entire queue for a counter.
   * Deletes ALL queue entries (waiting, serving, completed, etc.)
   * and resets the counter document to its initial state.
   * Also resets the sequential token counter back to A101.
   *
   * @param {string} counterId
   * @returns {Promise<void>}
   */
  async resetQueue(counterId) {
    const db = window.LineAlertFirebase.db;
    if (!db) throw new Error("Firestore not initialized.");

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;

    // Fetch ALL queue entries for this counter
    const snapshot = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .get();

    const batch = db.batch();

    // Delete every queue document
    snapshot.forEach(doc => batch.delete(doc.ref));

    // Reset counter document (and reset nextTokenNumber so tokens restart at A101)
    const counterRef = db.collection(window.LineAlertFirebase.COLLECTIONS.COUNTERS).doc(targetCounterId);
    batch.set(counterRef, {
      counterId:           targetCounterId,
      counterName:         window.LineAlertFirebase.DEFAULT_COUNTER_NAME,
      currentToken:        '---',
      currentCustomerName: '',
      isActive:            true,
      nextTokenNumber:     100,   // Will increment to 101 on first join
      updatedAt:           firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
    console.log(`[LineAlertQueue] Queue for counter "${targetCounterId}" has been reset.`);
  },

  // ─────────────────────────────────────────────────────────────
  // REAL-TIME LISTENERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Subscribes to real-time counter document updates.
   * Used to display the "Now Serving" token on the customer page.
   *
   * @param {string}   counterId        - Counter to subscribe to
   * @param {function} onUpdateCallback - Called with counter data on every change
   * @returns {function} Unsubscribe function (call to stop listening)
   */
  subscribeToCounter(counterId, onUpdateCallback) {
    const db = window.LineAlertFirebase.db;
    if (!db) return () => {};

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;

    return db.collection(window.LineAlertFirebase.COLLECTIONS.COUNTERS)
      .doc(targetCounterId)
      .onSnapshot(doc => {
        if (doc.exists) {
          onUpdateCallback(doc.data());
        }
      }, err => {
        console.error('[LineAlertQueue] Counter subscription error:', err);
      });
  },

  /**
   * Subscribes to real-time updates for the active queue (waiting + serving entries).
   * This is the PRIMARY stream used by both customer.js and admin.js.
   * - Customer page uses it to calculate position and trigger notifications.
   * - Admin page uses it to render the live waiting list table.
   *
   * @param {string}   counterId        - Counter to subscribe to
   * @param {function} onUpdateCallback - Called with array of active queue items on change
   * @returns {function} Unsubscribe function
   */
  subscribeToActiveQueue(counterId, onUpdateCallback) {
    const db = window.LineAlertFirebase.db;
    if (!db) return () => {};

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;

    return db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .onSnapshot(snapshot => {
        const items = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          // Only include active entries (waiting or serving)
          if (
            data.status === window.LineAlertFirebase.QUEUE_STATUS.WAITING ||
            data.status === window.LineAlertFirebase.QUEUE_STATUS.SERVING
          ) {
            items.push({ id: doc.id, ...data });
          }
        });

        // In-memory sort by createdAt ascending (zero Firestore index required!)
        items.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (new Date(a.createdAt).getTime() || 0));
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (new Date(b.createdAt).getTime() || 0));
          return tA - tB;
        });

        onUpdateCallback(items);
      }, err => {
        console.error('[LineAlertQueue] Active queue subscription error:', err);
      });
  }
};

// Make available globally for all pages
window.LineAlertQueue = LineAlertQueue;
