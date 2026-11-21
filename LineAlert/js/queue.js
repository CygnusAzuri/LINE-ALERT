/**
 * LINE ALERT - Queue Management Core Logic
 * Module: Member 2 (Queue Management) & Member 4 (Database Integration)
 * 
 * Contains all business logic for queue calculations, token generation,
 * and Firestore operations.
 */

const LineAlertQueue = {
  /**
   * Generates a new formatted token string (e.g. A101, A102...)
   * In MVP, we can derive this from timestamp or simple random/increment.
   */
  generateTokenId() {
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `A${randomNum}`;
  },

  /**
   * Adds a customer to the Firestore queue.
   * @param {string} counterId 
   * @param {string} customerName 
   * @returns {Promise<object>} The newly created queue document data
   */
  async addCustomerToQueue(counterId, customerName) {
    const db = window.LineAlertFirebase.db;
    if (!db) throw new Error("Firestore not initialized.");

    const tokenId = this.generateTokenId();
    const queueData = {
      tokenId: tokenId,
      counterId: counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID,
      customerName: customerName.trim(),
      status: window.LineAlertFirebase.QUEUE_STATUS.WAITING,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES).add(queueData);
    return { id: docRef.id, ...queueData };
  },

  /**
   * Marks a user as cancelled when they leave the queue.
   * @param {string} queueDocId 
   */
  async leaveQueue(queueDocId) {
    const db = window.LineAlertFirebase.db;
    if (!db || !queueDocId) return;

    await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .doc(queueDocId)
      .update({
        status: window.LineAlertFirebase.QUEUE_STATUS.CANCELLED,
        cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  },

  /**
   * Admin: Call next customer in the queue.
   * Moves oldest 'waiting' to 'serving' and marks previous 'serving' as 'completed'.
   * @param {string} counterId 
   * @returns {Promise<object|null>} The called customer or null
   */
  async callNextCustomer(counterId) {
    const db = window.LineAlertFirebase.db;
    if (!db) throw new Error("Firestore not initialized.");

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;

    // 1. Find oldest waiting customer
    const waitingSnapshot = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .where('status', '==', window.LineAlertFirebase.QUEUE_STATUS.WAITING)
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get();

    if (waitingSnapshot.empty) {
      return null;
    }

    const nextDoc = waitingSnapshot.docs[0];
    const nextData = nextDoc.data();

    // 2. Mark any currently serving customer as completed
    const currentServingSnapshot = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .where('status', '==', window.LineAlertFirebase.QUEUE_STATUS.SERVING)
      .get();

    const batch = db.batch();

    currentServingSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        status: window.LineAlertFirebase.QUEUE_STATUS.COMPLETED,
        completedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    // 3. Mark next customer as serving
    batch.update(nextDoc.ref, {
      status: window.LineAlertFirebase.QUEUE_STATUS.SERVING,
      servedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 4. Update counter currentToken
    const counterRef = db.collection(window.LineAlertFirebase.COLLECTIONS.COUNTERS).doc(targetCounterId);
    batch.update(counterRef, {
      currentToken: nextData.tokenId,
      currentCustomerName: nextData.customerName,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    return { id: nextDoc.id, ...nextData };
  },

  /**
   * Admin: Mark the currently serving customer as completed.
   * @param {string} counterId 
   */
  async markCurrentAsServed(counterId) {
    const db = window.LineAlertFirebase.db;
    if (!db) return;

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;

    const servingSnapshot = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .where('status', '==', window.LineAlertFirebase.QUEUE_STATUS.SERVING)
      .get();

    if (servingSnapshot.empty) return;

    const batch = db.batch();
    servingSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        status: window.LineAlertFirebase.QUEUE_STATUS.COMPLETED,
        completedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    // Reset current token in counter
    const counterRef = db.collection(window.LineAlertFirebase.COLLECTIONS.COUNTERS).doc(targetCounterId);
    batch.update(counterRef, {
      currentToken: '---',
      currentCustomerName: '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
  },

  /**
   * Admin: Skip currently serving customer.
   * @param {string} counterId 
   */
  async skipCurrentCustomer(counterId) {
    const db = window.LineAlertFirebase.db;
    if (!db) return;

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;

    const servingSnapshot = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .where('status', '==', window.LineAlertFirebase.QUEUE_STATUS.SERVING)
      .get();

    if (servingSnapshot.empty) return;

    const batch = db.batch();
    servingSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        status: window.LineAlertFirebase.QUEUE_STATUS.SKIPPED,
        skippedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    const counterRef = db.collection(window.LineAlertFirebase.COLLECTIONS.COUNTERS).doc(targetCounterId);
    batch.update(counterRef, {
      currentToken: '---',
      currentCustomerName: '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
  },

  /**
   * Admin: Reset all queue entries for this counter.
   * @param {string} counterId 
   */
  async resetQueue(counterId) {
    const db = window.LineAlertFirebase.db;
    if (!db) return;

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;

    const snapshot = await db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .get();

    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    const counterRef = db.collection(window.LineAlertFirebase.COLLECTIONS.COUNTERS).doc(targetCounterId);
    batch.set(counterRef, {
      counterId: targetCounterId,
      counterName: window.LineAlertFirebase.DEFAULT_COUNTER_NAME,
      currentToken: '---',
      currentCustomerName: '',
      isActive: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
  },

  /**
   * Realtime Listener: Subscribes to counter updates.
   * @param {string} counterId 
   * @param {function} onUpdateCallback 
   * @returns {function} Unsubscribe function
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
      });
  },

  /**
   * Realtime Listener: Subscribes to waiting list for a counter.
   * @param {string} counterId 
   * @param {function} onUpdateCallback 
   * @returns {function} Unsubscribe function
   */
  subscribeToActiveQueue(counterId, onUpdateCallback) {
    const db = window.LineAlertFirebase.db;
    if (!db) return () => {};

    const targetCounterId = counterId || window.LineAlertFirebase.DEFAULT_COUNTER_ID;
    return db.collection(window.LineAlertFirebase.COLLECTIONS.QUEUES)
      .where('counterId', '==', targetCounterId)
      .orderBy('createdAt', 'asc')
      .onSnapshot(snapshot => {
        const items = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.status === window.LineAlertFirebase.QUEUE_STATUS.WAITING || 
              data.status === window.LineAlertFirebase.QUEUE_STATUS.SERVING) {
            items.push({ id: doc.id, ...data });
          }
        });
        onUpdateCallback(items);
      });
  }
};

window.LineAlertQueue = LineAlertQueue;
