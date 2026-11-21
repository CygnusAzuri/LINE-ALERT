/**
 * LINE ALERT - Customer Interface Controller
 * Module: Member 3 (QR Code & Customer Module) & Member 4 (Integration)
 */

document.addEventListener('DOMContentLoaded', () => {
  const counterId = window.LineAlertFirebase.DEFAULT_COUNTER_ID;

  // DOM Elements
  const notificationBanner = document.getElementById('notificationBanner');
  const btnEnableNotifications = document.getElementById('btnEnableNotifications');
  
  const joinQueueView = document.getElementById('joinQueueView');
  const activeQueueView = document.getElementById('activeQueueView');
  const joinQueueForm = document.getElementById('joinQueueForm');
  const customerNameInput = document.getElementById('customerNameInput');
  
  const nowServingDisplay = document.getElementById('nowServingDisplay');
  const totalWaitingDisplay = document.getElementById('totalWaitingDisplay');
  
  const userTokenDisplay = document.getElementById('userTokenDisplay');
  const queueStatusPill = document.getElementById('queueStatusPill');
  const peopleAheadDisplay = document.getElementById('peopleAheadDisplay');
  const estWaitDisplay = document.getElementById('estWaitDisplay');
  const counterActiveServingDisplay = document.getElementById('counterActiveServingDisplay');
  const btnLeaveQueue = document.getElementById('btnLeaveQueue');

  // Check saved session
  let currentQueueDocId = localStorage.getItem('linealert_doc_id');
  let currentTokenId = localStorage.getItem('linealert_token_id');

  // 1. Notification Permission Prompt
  if ("Notification" in window && Notification.permission === "default") {
    notificationBanner.style.display = 'block';
    btnEnableNotifications.addEventListener('click', async () => {
      const res = await window.notifier.requestPermission();
      if (res === 'granted' || res === 'denied') {
        notificationBanner.style.display = 'none';
      }
    });
  }

  // 2. Realtime Listener for General Counter Info (Always Active)
  LineAlertQueue.subscribeToCounter(counterId, (counterData) => {
    if (!counterData) return;
    const token = counterData.currentToken || '---';
    if (nowServingDisplay) nowServingDisplay.textContent = token;
    if (counterActiveServingDisplay) counterActiveServingDisplay.textContent = token;
  });

  // 3. Realtime Queue Stream for Position Calculation
  let unsubscribeQueue = null;

  function startQueueMonitoring() {
    if (unsubscribeQueue) unsubscribeQueue();

    unsubscribeQueue = LineAlertQueue.subscribeToActiveQueue(counterId, (items) => {
      // Update general waiting count
      const waitingOnly = items.filter(i => i.status === window.LineAlertFirebase.QUEUE_STATUS.WAITING);
      if (totalWaitingDisplay) totalWaitingDisplay.textContent = waitingOnly.length;

      // If user has an active token, calculate their specific status and position
      if (currentTokenId) {
        const userItem = items.find(i => i.tokenId === currentTokenId);

        if (!userItem) {
          // Token completed, cancelled, or not found in active list
          // Check if previously active
          if (currentQueueDocId) {
            console.log("[Customer] Active token session ended or completed.");
          }
          return;
        }

        // Token is found!
        if (userItem.status === window.LineAlertFirebase.QUEUE_STATUS.SERVING) {
          // USER IS NOW SERVING
          queueStatusPill.textContent = "It's Your Turn! (Serving)";
          queueStatusPill.className = "status-pill status-serving";
          peopleAheadDisplay.textContent = "0";
          estWaitDisplay.textContent = "Now!";
          
          // Trigger notification
          window.notifier.processQueuePositionChange(userItem, 0);

        } else if (userItem.status === window.LineAlertFirebase.QUEUE_STATUS.WAITING) {
          // USER IS WAITING
          // Calculate how many people ahead (index of this item among waiting items)
          const userIndexInWaiting = waitingOnly.findIndex(i => i.tokenId === currentTokenId);
          const peopleAhead = userIndexInWaiting >= 0 ? userIndexInWaiting : 0;
          // Use Member 2's centralized wait-time estimator
          const estWait = LineAlertQueue.estimateWaitMinutes(peopleAhead);

          peopleAheadDisplay.textContent = peopleAhead;
          estWaitDisplay.textContent = estWait;

          if (peopleAhead <= 2) {
            queueStatusPill.textContent = "Turn Approaching!";
            queueStatusPill.className = "status-pill status-alert";
          } else {
            queueStatusPill.textContent = "Waiting in Line";
            queueStatusPill.className = "status-pill status-waiting";
          }

          // Trigger notification if 2 or fewer people ahead
          window.notifier.processQueuePositionChange(userItem, peopleAhead);
        }
      }
    });
  }

  startQueueMonitoring();

  // 4. Initial View Render based on stored token
  if (currentTokenId && currentQueueDocId) {
    showActiveQueueView(currentTokenId);
  } else {
    showJoinView();
  }

  function showActiveQueueView(token) {
    userTokenDisplay.textContent = token;
    joinQueueView.style.display = 'none';
    activeQueueView.style.display = 'block';
  }

  function showJoinView() {
    joinQueueView.style.display = 'block';
    activeQueueView.style.display = 'none';
    window.notifier.resetAlertState();
  }

  // 5. Join Queue Form Submission
  joinQueueForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = customerNameInput.value.trim();
    if (!name) return;

    const btnSubmit = document.getElementById('btnJoinQueue');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>⏳</span><span>Joining Queue...</span>';

    try {
      // Request notification permission if still default
      if ("Notification" in window && Notification.permission === "default") {
        window.notifier.requestPermission().catch(() => {});
      }

      const newEntry = await LineAlertQueue.addCustomerToQueue(counterId, name);
      currentTokenId = newEntry.tokenId;
      currentQueueDocId = newEntry.id;

      localStorage.setItem('linealert_token_id', currentTokenId);
      localStorage.setItem('linealert_doc_id', currentQueueDocId);

      window.notifier.playChimeTone('success');
      window.notifier.showInAppToast(`You joined with Token ${currentTokenId}!`, 'success');

      showActiveQueueView(currentTokenId);
      startQueueMonitoring();
    } catch (err) {
      alert("Error joining queue: " + err.message);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<span>🎟️</span><span>Join Queue Now</span>';
    }
  });

  // 6. Leave Queue
  btnLeaveQueue.addEventListener('click', async () => {
    if (!confirm("Are you sure you want to leave the queue?")) return;

    try {
      if (currentQueueDocId) {
        await LineAlertQueue.leaveQueue(currentQueueDocId);
      }
      window.notifier.playChimeTone('cancel');
      window.notifier.showInAppToast("You have left the queue.", "info");

      localStorage.removeItem('linealert_token_id');
      localStorage.removeItem('linealert_doc_id');
      currentTokenId = null;
      currentQueueDocId = null;

      showJoinView();
    } catch (err) {
      alert("Error leaving queue: " + err.message);
    }
  });
});
