document.getElementById("copyButton").addEventListener("click", function () {
    const textarea = document.getElementById("hotlinkTextarea");

    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    try {
        const successful = document.execCommand("copy");
        if (successful) {
            const button = document.getElementById("copyButton");
            button.textContent = "Copied!";
            setTimeout(() => {
                button.textContent = "Copy";
            }, 1000);
        } else {
            console.error("Failed to copy.");
        }
    } catch (err) {
        console.error("Error copying text: ", err);
    }
});