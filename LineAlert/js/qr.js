/**
 * LINE ALERT - QR Code Generator & Scanner Helper
 * Module: Member 3 (QR Code & Customer Module)
 */

const LineAlertQR = {
  /**
   * Generates a QR code inside the specified DOM element linking to the customer queue page.
   * @param {string} containerElementId 
   * @param {string} counterId 
   * @param {object} customOptions 
   */
  generateCounterQR(containerElementId, counterId = 'CANTEEN01', customOptions = {}) {
    const container = document.getElementById(containerElementId);
    if (!container) {
      console.error(`[LineAlertQR] Container element #${containerElementId} not found.`);
      return;
    }

    // Clear previous QR code if any
    container.innerHTML = '';

    // Calculate URL pointing to customer.html with counter query param
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const targetUrl = `${baseUrl}customer.html?counter=${encodeURIComponent(counterId)}`;

    const options = {
      text: targetUrl,
      width: customOptions.width || 180,
      height: customOptions.height || 180,
      colorDark: customOptions.colorDark || "#0f172a",
      colorLight: customOptions.colorLight || "#ffffff",
      correctLevel: (typeof QRCode !== 'undefined' && QRCode.CorrectLevel) ? QRCode.CorrectLevel.H : 2
    };

    if (typeof QRCode !== 'undefined') {
      try {
        new QRCode(container, options);
        console.log(`[LineAlertQR] Generated QR for counter ${counterId}: ${targetUrl}`);
      } catch (e) {
        console.error("[LineAlertQR] Error generating QR code:", e);
      }
    } else {
      console.warn("[LineAlertQR] QRCode library not loaded. Ensure qrcode.min.js is included.");
      container.innerHTML = `
        <div class="alert alert-secondary small text-center p-2">
          QR Code: <a href="${targetUrl}" target="_blank">${targetUrl}</a>
        </div>
      `;
    }

    return targetUrl;
  }
};

window.LineAlertQR = LineAlertQR;
