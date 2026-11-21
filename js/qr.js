
/*
    LINE ALERT
    Member 3: QR Code Module

    Generates a QR code containing the customer page URL
    and the selected counter information.
*/

const qrForm = document.getElementById("qrForm");
const qrCodeContainer = document.getElementById("qrCode");
const qrResult = document.getElementById("qrResult");
const qrMessage = document.getElementById("qrMessage");

const downloadQRButton = document.getElementById("downloadQR");

let generatedQRCode = null;


// Generate QR Code
qrForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const counterName = document.getElementById("counterName").value.trim();
    const counterId = document.getElementById("counterId").value.trim();

    if (!counterName || !counterId) {
        qrMessage.textContent = "Please enter all counter details.";
        qrMessage.className = "mt-3 text-danger";
        return;
    }

    if (typeof QRCode === "undefined") {
        qrMessage.textContent = "QR library could not load. Check your internet connection.";
        qrMessage.className = "mt-3 text-danger";
        return;
    }

    // Build the customer page URL
    const customerURL = new URL("customer.html", window.location.href);

    customerURL.searchParams.set("counterId", counterId);
    customerURL.searchParams.set("counterName", counterName);

    // Clear previous QR code
    qrCodeContainer.innerHTML = "";

    // Generate new QR code
    generatedQRCode = new QRCode(qrCodeContainer, {
        text: customerURL.toString(),
        width: 220,
        height: 220,
        colorDark: "#172554",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    // Display result
    document.getElementById("generatedCounterName").textContent =
        counterName + " - QR Code";

    document.getElementById("generatedUrl").textContent =
        customerURL.toString();

    qrResult.hidden = false;

    qrMessage.textContent = "QR code generated successfully.";
    qrMessage.className = "mt-3 text-success";

});


// Download QR Code
downloadQRButton.addEventListener("click", function () {

    const canvas = qrCodeContainer.querySelector("canvas");
    const image = qrCodeContainer.querySelector("img");

    let imageURL;

    if (canvas) {
        imageURL = canvas.toDataURL("image/png");
    } else if (image && image.src) {
        imageURL = image.src;
    } else {
        qrMessage.textContent = "Generate a QR code first.";
        qrMessage.className = "mt-3 text-danger";
        return;
    }

    const downloadLink = document.createElement("a");

    downloadLink.href = imageURL;
    downloadLink.download = "LINE-ALERT-" +
        document.getElementById("counterId").value.trim() + ".png";

    downloadLink.click();

});
