/**
 * LINE ALERT - Admin & Counter Controller
 * Module: Member 2 (Queue Management)
 * Author: Vanshika (Member 2)
 * Branch: member2-queue-logic
 *
 * Responsibilities:
 *   - Display real-time "Currently Serving" token and customer name
 *   - Render live waiting queue table with positions
 *   - Handle admin button actions: Call Next, Mark Served, Skip, Reset Queue
 *   - Persist served count across page refreshes using localStorage
 *   - Show estimated wait time for each customer in the queue
 *
 * Depends on:
 *   - window.LineAlertFirebase (firebase-config.js — Member 4)
 *   - window.LineAlertQueue    (queue.js         — Member 2)
 *   - window.notifier          (notification.js  — Member 4)
 */

document.addEventListener('DOMContentLoaded', () => {
  const counterId = window.LineAlertFirebase.DEFAULT_COUNTER_ID;

  // ── DOM References ──────────────────────────────────────────
  const adminServingToken        = document.getElementById('adminServingToken');
  const adminServingCustomerName = document.getElementById('adminServingCustomerName');
  const btnCallNext              = document.getElementById('btnCallNext');
  const btnMarkServed            = document.getElementById('btnMarkServed');
  const btnSkip                  = document.getElementById('btnSkip');
  const btnResetQueue            = document.getElementById('btnResetQueue');
  const waitingBadge             = document.getElementById('waitingBadge');
  const statWaitingCount         = document.getElementById('statWaitingCount');
  const statServedCount          = document.getElementById('statServedCount');
  const adminQueueTableBody      = document.getElementById('adminQueueTableBody');

  // ── Served Count (Persistent across refreshes) ──────────────
  // Store served count in localStorage so it survives a page reload.
  // Resets to 0 when the admin clicks "Reset Queue".
  const SERVED_COUNT_KEY = `linealert_served_count_${counterId}`;
  let servedCount = parseInt(localStorage.getItem(SERVED_COUNT_KEY) || '0', 10);
  if (statServedCount) statServedCount.textContent = servedCount;

  function incrementServedCount() {
    servedCount++;
    localStorage.setItem(SERVED_COUNT_KEY, servedCount);
    if (statServedCount) statServedCount.textContent = servedCount;
  }

  function resetServedCount() {
    servedCount = 0;
    localStorage.setItem(SERVED_COUNT_KEY, '0');
    if (statServedCount) statServedCount.textContent = '0';
  }

  // ── 1. Subscribe to Counter Document (Now Serving display) ──
  LineAlertQueue.subscribeToCounter(counterId, (counterData) => {
    if (!counterData) return;
    const token = counterData.currentToken || '---';
    const name  = counterData.currentCustomerName || '';

    if (adminServingToken)        adminServingToken.textContent = token;
    if (adminServingCustomerName) {
      adminServingCustomerName.textContent = (token !== '---' && name)
        ? `Customer: ${name}`
        : 'Waiting for next customer...';
    }
  });

  // ── 2. Subscribe to Active Waiting Queue (Live Table) ───────
  LineAlertQueue.subscribeToActiveQueue(counterId, (items) => {
    // Filter to only waiting customers for the table
    const waitingItems = items.filter(
      i => i.status === window.LineAlertFirebase.QUEUE_STATUS.WAITING
    );

    // Update count displays
    if (waitingBadge)      waitingBadge.textContent      = `${waitingItems.length} in line`;
    if (statWaitingCount)  statWaitingCount.textContent   = waitingItems.length;

    // Render live table rows
    if (waitingItems.length === 0) {
      adminQueueTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            ✅ No customers currently waiting in queue.
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    waitingItems.forEach((item, index) => {
      const position = index + 1;
      const peopleAhead = index; // 0 = next in line

      // Format join time
      let timeStr = 'Just now';
      if (item.createdAt) {
        const dateObj = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
        timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      // Estimated wait using Member 2's helper
      const estWait = LineAlertQueue.estimateWaitMinutes(peopleAhead);

      // Highlight the next-in-line row
      const rowClass = (position === 1) ? 'table-primary' : '';

      rowsHtml += `
        <tr class="${rowClass}">
          <td>
            <span class="badge ${position === 1 ? 'bg-primary' : 'bg-secondary'} rounded-pill px-2 py-1">
              #${position}
            </span>
          </td>
          <td class="fw-bold text-primary">${item.tokenId}</td>
          <td>${item.customerName || 'Anonymous'}</td>
          <td class="text-muted small">${timeStr}</td>
          <td class="text-end">
            <span class="badge ${position === 1 ? 'bg-primary' : 'bg-warning text-dark'}">
              ${position === 1 ? 'Next ↑' : `~${estWait}`}
            </span>
          </td>
        </tr>
      `;
    });

    adminQueueTableBody.innerHTML = rowsHtml;
  });

  // ── 3. Admin Button Actions ─────────────────────────────────

  /**
   * CALL NEXT CUSTOMER
   * Moves the oldest waiting customer to 'serving'.
   * Also marks any currently serving customer as 'completed'.
   */
  btnCallNext.addEventListener('click', async () => {
    try {
      btnCallNext.disabled = true;
      btnCallNext.innerHTML = '<span>⏳</span><span>Calling...</span>';

      const called = await LineAlertQueue.callNextCustomer(counterId);

      if (called) {
        window.notifier.playChimeTone('serving');
        window.notifier.showInAppToast(
          `📢 Called Token <strong>${called.tokenId}</strong> — ${called.customerName}`,
          'success'
        );
        // Increment served count when previous serving customer completes
        // (callNextCustomer automatically completes the previous serving customer)
        incrementServedCount();
      } else {
        window.notifier.showInAppToast('⚠️ Queue is empty — no customers waiting!', 'warning');
      }
    } catch (err) {
      console.error('[Admin] Error calling next customer:', err);
      window.notifier.showInAppToast(`Error: ${err.message}`, 'danger');
    } finally {
      btnCallNext.disabled = false;
      btnCallNext.innerHTML = '<span>📢</span><span>Call Next Customer</span>';
    }
  });

  /**
   * MARK AS SERVED
   * Marks the currently serving customer as completed.
   */
  btnMarkServed.addEventListener('click', async () => {
    try {
      btnMarkServed.disabled = true;
      await LineAlertQueue.markCurrentAsServed(counterId);
      window.notifier.playChimeTone('success');
      window.notifier.showInAppToast('✅ Customer marked as served!', 'success');
    } catch (err) {
      console.error('[Admin] Error marking as served:', err);
      window.notifier.showInAppToast(`Error: ${err.message}`, 'danger');
    } finally {
      btnMarkServed.disabled = false;
    }
  });

  /**
   * SKIP CUSTOMER
   * Marks the currently serving customer as skipped (did not show up).
   */
  btnSkip.addEventListener('click', async () => {
    try {
      btnSkip.disabled = true;
      await LineAlertQueue.skipCurrentCustomer(counterId);
      window.notifier.playChimeTone('cancel');
      window.notifier.showInAppToast('⏭️ Customer skipped.', 'warning');
    } catch (err) {
      console.error('[Admin] Error skipping customer:', err);
      window.notifier.showInAppToast(`Error: ${err.message}`, 'danger');
    } finally {
      btnSkip.disabled = false;
    }
  });

  /**
   * RESET QUEUE
   * Clears all queue entries, resets the counter, and resets served count.
   */
  btnResetQueue.addEventListener('click', async () => {
    const confirmed = confirm(
      '⚠️ Are you sure you want to reset the queue?\n\n' +
      'This will remove ALL customers (waiting and serving) and restart token numbering from A101.'
    );
    if (!confirmed) return;

    try {
      btnResetQueue.disabled = true;
      await LineAlertQueue.resetQueue(counterId);
      resetServedCount();
      window.notifier.showInAppToast('🗑️ Queue has been reset. Tokens restart from A101.', 'info');
    } catch (err) {
      console.error('[Admin] Error resetting queue:', err);
      window.notifier.showInAppToast(`Error: ${err.message}`, 'danger');
    } finally {
      btnResetQueue.disabled = false;
    }
  });
});
