
/*
    LINE ALERT
    Member 3: Customer Notification Module

    Handles browser notification permission,
    customer turn alerts and device vibration.
*/

// Request browser notification permission
async function requestNotificationPermission() {

    if (!("Notification" in window)) {
        console.warn("Browser notifications are not supported.");
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission === "denied") {
        console.warn("Notification permission was denied.");
        return false;
    }

    const permission = await Notification.requestPermission();

    return permission === "granted";
}


// Send customer notification
function sendTurnNotification(title, message) {

    if (!("Notification" in window)) {
        console.warn("Notifications are not supported.");
        return;
    }

    if (Notification.permission !== "granted") {
        console.warn("Notification permission not granted.");
        return;
    }

    const notification = new Notification(title, {
        body: message,
        tag: "line-alert-turn",
        requireInteraction: true
    });

    // Focus customer page when notification is clicked
    notification.onclick = function () {
        window.focus();
        notification.close();
    };

    // Vibrate supported mobile devices
    if ("vibrate" in navigator) {
        navigator.vibrate([300, 100, 300]);
    }
}


// Notify customer that their turn is approaching
function notifyTurnApproaching(peopleAhead) {

    if (peopleAhead <= 3 && peopleAhead > 0) {

        sendTurnNotification(
            "LINE ALERT - Your Turn Is Approaching",
            `Only ${peopleAhead} people are ahead of you. Please get ready.`
        );

    } else if (peopleAhead === 0) {

        sendTurnNotification(
            "LINE ALERT - It's Your Turn!",
            "Please proceed to the counter."
        );

    }
}

