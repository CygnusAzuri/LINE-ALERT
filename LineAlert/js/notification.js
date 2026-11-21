/**
 * LINE ALERT - Notification & Alert Subsystem
 * Module: Member 4 (Notifications, Database & Deployment)
 * 
 * Capabilities:
 * 1. Web Notification API (Desktop & Mobile Browser Push)
 * 2. Web Audio API Synthesizer (Zero-dependency chime tones for foreground alerts)
 * 3. Mobile Device Vibration API (Tactile feedback)
 * 4. In-App Banner/Toast Fallback (Guaranteed UI feedback when notifications are denied)
 * 5. Position Watcher with anti-spam suppression (Alerts once when <= 2 people ahead)
 */

class LineAlertNotifier {
  constructor() {
    this.audioCtx = null;
    this.lastAlertedPosition = null;
    this.hasAlertedForTurn = false;
    this.bannerContainer = null;
    this.initAudioContextOnUserGesture();
    this.setupBannerContainer();
  }

  /**
   * Lazily initializes Web Audio Context on the first user click/tap
   * to comply with browser autoplay policies.
   */
  initAudioContextOnUserGesture() {
    const unlockAudio = () => {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass && !this.audioCtx) {
          this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
      } catch (e) {
        console.warn("[LineAlert] Web Audio not supported or failed to resume:", e);
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };

    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
  }

  /**
   * Requests permission for system/browser notifications.
   * @returns {Promise<string>} 'granted', 'denied', or 'default'
   */
  async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("[LineAlert] This browser does not support desktop notifications.");
      this.showInAppToast("Notifications not supported on this browser. Audio & visual alerts will be used.", "warning");
      return "unsupported";
    }

    if (Notification.permission === "granted") {
      return "granted";
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        this.showInAppToast("Notifications enabled! You'll receive queue updates.", "success");
        // Play a short confirmation chime
        this.playChimeTone('success');
      } else {
        this.showInAppToast("Notification permission denied. We will use sound and vibration.", "warning");
      }
      return permission;
    } catch (err) {
      console.error("[LineAlert] Error requesting notification permission:", err);
      return "denied";
    }
  }

  /**
   * Checks current permission state.
   */
  getPermissionStatus() {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  }

  /**
   * Synthesizes audio alert chimes using the Web Audio API.
   * Does NOT require any external .mp3 file!
   * @param {'approaching'|'serving'|'success'|'cancel'} type 
   */
  playChimeTone(type = 'approaching') {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      const playTone = (freq, startOffset, duration, toneType = 'sine') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = toneType;
        osc.frequency.setValueAtTime(freq, now + startOffset);

        gain.gain.setValueAtTime(0.001, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.3, now + startOffset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration);
      };

      if (type === 'serving') {
        // Urgent 4-note ascending fanfare: C5, E5, G5, C6 (High priority)
        playTone(523.25, 0.0, 0.2, 'triangle');
        playTone(659.25, 0.18, 0.2, 'triangle');
        playTone(783.99, 0.36, 0.25, 'triangle');
        playTone(1046.50, 0.55, 0.5, 'sine');
      } else if (type === 'approaching') {
        // Double gentle chime: A5 (880Hz) -> C#6 (1108Hz)
        playTone(880.00, 0.0, 0.25, 'sine');
        playTone(1108.73, 0.25, 0.45, 'sine');
      } else if (type === 'success') {
        // Upbeat confirmation
        playTone(587.33, 0.0, 0.15, 'sine');
        playTone(880.00, 0.15, 0.3, 'sine');
      } else if (type === 'cancel') {
        // Low descending cancel tone
        playTone(440.00, 0.0, 0.2, 'sawtooth');
        playTone(330.00, 0.2, 0.35, 'sawtooth');
      }
    } catch (e) {
      console.warn("[LineAlert] Could not play synthesized audio tone:", e);
    }
  }

  /**
   * Vibrates mobile device if supported.
   * @param {number|number[]} pattern Milliseconds pattern, e.g. [200, 100, 200]
   */
  triggerVibration(pattern = [200, 100, 200]) {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        console.warn("[LineAlert] Vibration failed:", e);
      }
    }
  }

  /**
   * Ensures the floating toast container is injected into DOM.
   */
  setupBannerContainer() {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('line-alert-toast-container')) {
      const container = document.createElement('div');
      container.id = 'line-alert-toast-container';
      container.style.position = 'fixed';
      container.style.top = '20px';
      container.style.right = '20px';
      container.style.zIndex = '99999';
      container.style.maxWidth = '360px';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '10px';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);
      this.bannerContainer = container;
    } else {
      this.bannerContainer = document.getElementById('line-alert-toast-container');
    }
  }

  /**
   * Displays an in-app animated toast alert.
   * @param {string} message 
   * @param {'info'|'success'|'warning'|'danger'} type 
   * @param {number} durationMs 
   */
  showInAppToast(message, type = 'info', durationMs = 5000) {
    this.setupBannerContainer();
    if (!this.bannerContainer) return;

    const toast = document.createElement('div');
    toast.className = `alert alert-${type} shadow-lg`;
    toast.style.pointerEvents = 'auto';
    toast.style.transition = 'all 0.3s ease-in-out';
    toast.style.transform = 'translateY(-20px)';
    toast.style.opacity = '0';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'space-between';
    toast.style.margin = '0';
    toast.style.borderRadius = '12px';
    toast.style.fontSize = '0.95rem';

    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'danger') icon = '🚨';

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 1.3rem;">${icon}</span>
        <span>${message}</span>
      </div>
      <button type="button" class="btn-close ms-2" aria-label="Close" style="font-size: 0.75rem;"></button>
    `;

    const closeBtn = toast.querySelector('.btn-close');
    closeBtn.onclick = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    };

    this.bannerContainer.appendChild(toast);

    // Trigger smooth fade-in
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 10);

    // Auto remove
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, durationMs);
  }

  /**
   * Shows a standard Web Notification (if permission granted),
   * accompanied by audio chime and mobile vibration.
   * @param {string} title 
   * @param {object} options 
   */
  dispatchNotification(title, options = {}) {
    const defaultOptions = {
      icon: 'assets/logo.png',
      badge: 'assets/logo.png',
      tag: 'line-alert-notification',
      renotify: true,
      silent: false
    };
    const finalOptions = { ...defaultOptions, ...options };

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, finalOptions);
      } catch (e) {
        console.warn("[LineAlert] System notification dispatch failed:", e);
      }
    }

    // Always show in-app toast as well
    const toastType = options.alertType || 'info';
    this.showInAppToast(`<strong>${title}</strong><br>${options.body || ''}`, toastType, 7000);
  }

  /**
   * High-level: Alert customer that their turn is approaching (2-3 people ahead).
   * @param {number} peopleAhead 
   * @param {string} tokenNumber 
   */
  notifyTurnApproaching(peopleAhead, tokenNumber) {
    const title = "⚠️ LINE ALERT: Your Turn is Approaching!";
    const body = `Token ${tokenNumber}: Only ${peopleAhead} ${peopleAhead === 1 ? 'person' : 'people'} ahead of you in the queue. Please head towards the counter!`;

    // 1. Play alert chime
    this.playChimeTone('approaching');

    // 2. Mobile vibration: two distinct pulses
    this.triggerVibration([300, 150, 300]);

    // 3. Dispatch browser notification & banner
    this.dispatchNotification(title, {
      body: body,
      alertType: 'warning',
      tag: `turn-approaching-${tokenNumber}`
    });
  }

  /**
   * High-level: Alert customer that it's their turn RIGHT NOW (status: 'serving').
   * @param {string} tokenNumber 
   * @param {string} counterName 
   */
  notifyNowServing(tokenNumber, counterName = 'the counter') {
    const title = "🚨 IT'S YOUR TURN NOW!";
    const body = `Token ${tokenNumber} is being served right now at ${counterName}. Please present your token!`;

    // 1. Urgent fanfare chime
    this.playChimeTone('serving');

    // 2. Long urgent vibration pattern
    this.triggerVibration([400, 150, 400, 150, 600]);

    // 3. Dispatch browser notification & banner
    this.dispatchNotification(title, {
      body: body,
      alertType: 'danger',
      tag: `now-serving-${tokenNumber}`,
      requireInteraction: true
    });
  }

  /**
   * Evaluates queue updates and triggers notifications appropriately without duplicate spam.
   * Call this from your customer queue listener.
   * @param {object} queueItem - The customer's queue document
   * @param {number} peopleAhead - Number of people ahead
   */
  processQueuePositionChange(queueItem, peopleAhead) {
    if (!queueItem) return;

    const tokenNumber = queueItem.tokenId || 'Your Token';
    const status = queueItem.status;

    // 1. Check if token is now SERVING
    if (status === 'serving' && !this.hasAlertedForTurn) {
      this.hasAlertedForTurn = true;
      this.notifyNowServing(tokenNumber);
      return;
    }

    // 2. Check if token is WAITING and 2 or fewer people are ahead
    if (status === 'waiting' && peopleAhead <= 2 && peopleAhead >= 1) {
      // Only alert if we haven't alerted for this exact position yet
      if (this.lastAlertedPosition !== peopleAhead) {
        this.lastAlertedPosition = peopleAhead;
        this.notifyTurnApproaching(peopleAhead, tokenNumber);
      }
    }
  }

  /**
   * Resets alert state (e.g., when joining a new queue).
   */
  resetAlertState() {
    this.lastAlertedPosition = null;
    this.hasAlertedForTurn = false;
  }
}

// Global Singleton Instance
window.notifier = new LineAlertNotifier();
