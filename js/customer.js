
// LINE ALERT - Customer Module
// Member 3: Customer-side interactions
// Temporary frontend demonstration only.

// HTML Elements
const joinQueueForm = document.getElementById("joinQueueForm");
const customerName = document.getElementById("customerName");

const queueStatus = document.getElementById("queueStatus");
const joinQueueBtn = document.getElementById("joinQueueBtn");
const leaveQueueBtn = document.getElementById("leaveQueueBtn");

const tokenNumber = document.getElementById("tokenNumber");
const queuePosition = document.getElementById("queuePosition");
const peopleAhead = document.getElementById("peopleAhead");

const message = document.getElementById("message");

// Temporary demonstration state
let customerToken = null;
let demoPosition = null;


// Join Queue
joinQueueForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const name = customerName.value.trim();

    if (name === "") {
        message.textContent = "Please enter your name.";
        message.className = "text-center mt-3 text-danger";
        return;
    }

    // Temporary demo token.
    // Final token generation will use Member 2's queue logic.
    customerToken = "DEMO" + Math.floor(100 + Math.random() * 900);

    // Temporary demo position.
    demoPosition = Math.floor(Math.random() * 5) + 1;

    // Display token
    tokenNumber.textContent = customerToken;

    // Display queue position
    queuePosition.textContent = demoPosition;

    // Display people ahead
    peopleAhead.textContent = demoPosition - 1;

    // Update interface
    joinQueueForm.hidden = true;
    queueStatus.hidden = false;

    message.textContent = "You have joined the demonstration queue.";
    message.className = "text-center mt-3 text-success";

    // Update counter status
    document.getElementById("counterStatus").textContent =
        "Demo mode - Not connected to live queue";

});


// Leave Queue
leaveQueueBtn.addEventListener("click", function () {

    customerToken = null;
    demoPosition = null;

    // Reset interface
    joinQueueForm.hidden = false;
    queueStatus.hidden = true;

    customerName.value = "";

    message.textContent = "You have left the demonstration queue.";
    message.className = "text-center mt-3 text-danger";

    document.getElementById("counterStatus").textContent =
        "Demo mode - Not connected to live queue";

});

// Read counter details from the QR code URL
const urlParameters = new URLSearchParams(window.location.search);

const counterId = urlParameters.get("counterId");
const counterName = urlParameters.get("counterName");

// Display the selected counter
if (counterName) {
    document.getElementById("counterName").textContent = counterName;
}

// Store the counter ID for future Firebase integration
console.log("Counter ID:", counterId);
// Enable notifications through a user click
const enableNotificationsBtn =
    document.getElementById("enableNotificationsBtn");


enableNotificationsBtn.addEventListener("click", async function () {

    const permission = await requestNotificationPermission();

    if (permission) {

        enableNotificationsBtn.textContent = "Notifications Enabled";

        message.textContent = "Notifications permission granted.";
        message.className = "text-center mt-3 text-success";

        // Test notification immediately after the user clicks
        const testNotification = new Notification(
            "LINE ALERT - Test",
            {
                body: "Your notification system is working."
            }
        );

        testNotification.onshow = function () {
            console.log("Notification displayed successfully.");
        };

        testNotification.onerror = function (error) {
            console.error("Notification display error:", error);
        };

    } else {

        message.textContent = "Notification permission denied.";
        message.className = "text-center mt-3 text-danger";

    }

});
