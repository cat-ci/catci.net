function getStatus() {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay();
    const date = now.getTime();

    const schoolTerms = [
        [new Date("2024-08-19T00:00:00Z"), new Date("2024-10-11T23:59:59Z")],
        [new Date("2024-10-28T00:00:00Z"), new Date("2024-12-20T23:59:59Z")],
        [new Date("2025-01-06T00:00:00Z"), new Date("2025-03-28T23:59:59Z")],
        [new Date("2025-04-14T00:00:00Z"), new Date("2025-07-04T23:59:59Z")]
    ];

    if (day === 0 || day === 6) {
        return "Home";
    }

    const inSchoolTerm = schoolTerms.some(([start, end]) => date >= start.getTime() && date <= end.getTime());

    if (inSchoolTerm && hour >= 8 && hour < 15) {
        return "School";
    }

    return "Home";
}

function updateLocation() {
    const locationElement = document.getElementById("location");
    if (locationElement) {
        const status = getStatus();
        const emoji = status === "School" ? "🏫" : "🏠";
        locationElement.innerHTML = `${status} <span class="emoji-symbol">${emoji}</span>`;
    }
}

window.onload = updateLocation;