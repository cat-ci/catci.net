function updateClock() {
    const now = new Date();
    const options = { timeZone: "Europe/London", hour12: false, hour: "2-digit", minute: "2-digit" };
    const timeString = new Intl.DateTimeFormat("en-GB", options).format(now);

    document.getElementById("scotland-time").innerText = `${timeString}`;
}

updateClock();
setInterval(updateClock, 1000);