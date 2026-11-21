/**
 * LINE ALERT - Admin & Counter Controller
 * Module: Member 2 (Queue Logic) & Member 4 (Integration)
 */

document.addEventListener('DOMContentLoaded', () => {
  const counterId = window.LineAlertFirebase.DEFAULT_COUNTER_ID;

  // DOM Elements
  const adminServingToken = document.getElementById('adminServingToken');
  const adminServingCustomerName = document.getElementById('adminServingCustomerName');
  const btnCallNext = document.getElementById('btnCallNext');
  const btnMarkServed = document.getElementById('btnMarkServed');
  const btnSkip = document.getElementById('btnSkip');
  const btnResetQueue = document.getElementById('btnResetQueue');
  
  const waitingBadge = document.getElementById('waitingBadge');
  const statWaitingCount = document.getElementById('statWaitingCount');
  const statServedCount = document.getElementById('statServedCount');
  const adminQueueTableBody = document.getElementById('adminQueueTableBody');

  let servedCount = 0;

  // 1. Subscribe to Counter document
  LineAlertQueue.subscribeToCounter(counterId, (counterData) => {
    if (!counterData) return;
    const token = counterData.currentToken || '---';
    const name = counterData.currentCustomerName || 'No customer at counter';
    
    adminServingToken.textContent = token;
    adminServingCustomerName.textContent = token !== '---' ? `Customer: ${name}` : 'Waiting for next customer...';
  });

  // 2. Subscribe to Waiting Queue
  LineAlertQueue.subscribeToActiveQueue(counterId, (items) => {
    const waitingItems = items.filter(i => i.status === window.LineAlertFirebase.QUEUE_STATUS.WAITING);
    
    // Update count badges
    if (waitingBadge) waitingBadge.textContent = `${waitingItems.length} in line`;
    if (statWaitingCount) statWaitingCount.textContent = waitingItems.length;

    // Render Table
    if (waitingItems.length === 0) {
      adminQueueTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            No customers currently waiting in queue.
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    waitingItems.forEach((item, index) => {
      const position = index + 1;
      const timeStr = item.createdAt ? new Date(item.createdAt.toDate ? item.createdAt.toDate() : item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now';

      rowsHtml += `
        <tr>
          <td><span class="badge bg-secondary rounded-pill px-2 py-1">#${position}</span></td>
          <td class="fw-bold text-primary">${item.tokenId}</td>
          <td>${item.customerName || 'Anonymous'}</td>
          <td class="text-muted small">${timeStr}</td>
          <td class="text-end">
            <span class="badge bg-warning text-dark">Waiting</span>
          </td>
        </tr>
      `;
    });

    adminQueueTableBody.innerHTML = rowsHtml;
  });

  // 3. Button Actions
  btnCallNext.addEventListener('click', async () => {
    try {
      btnCallNext.disabled = true;
      const called = await LineAlertQueue.callNextCustomer(counterId);
      if (called) {
        window.notifier.playChimeTone('serving');
        window.notifier.showInAppToast(`Called Token ${called.tokenId} (${called.customerName})`, 'success');
        servedCount++;
        statServedCount.textContent = servedCount;
      } else {
        window.notifier.showInAppToast('No waiting customers in the queue!', 'warning');
      }
    } catch (err) {
      alert("Error calling next customer: " + err.message);
    } finally {
      btnCallNext.disabled = false;
    }
  });

  btnMarkServed.addEventListener('click', async () => {
    try {
      await LineAlertQueue.markCurrentAsServed(counterId);
      window.notifier.playChimeTone('success');
      window.notifier.showInAppToast('Customer marked as served.', 'success');
    } catch (err) {
      alert("Error completing service: " + err.message);
    }
  });

  btnSkip.addEventListener('click', async () => {
    try {
      await LineAlertQueue.skipCurrentCustomer(counterId);
      window.notifier.playChimeTone('cancel');
      window.notifier.showInAppToast('Customer skipped.', 'warning');
    } catch (err) {
      alert("Error skipping customer: " + err.message);
    }
  });

  btnResetQueue.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset the queue? All active customers will be cleared.')) return;
    try {
      await LineAlertQueue.resetQueue(counterId);
      window.notifier.showInAppToast('Queue reset successfully.', 'info');
      servedCount = 0;
      statServedCount.textContent = '0';
    } catch (err) {
      alert("Error resetting queue: " + err.message);
    }
  });
});
