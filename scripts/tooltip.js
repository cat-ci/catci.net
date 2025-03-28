document.addEventListener("DOMContentLoaded", () => {
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    document.body.appendChild(tooltip);

    const tooltipTargets = document.querySelectorAll(".tooltip-target");

    tooltipTargets.forEach((target) => {
        target.addEventListener("mouseenter", (event) => {
            const tooltipText = target.getAttribute("data-tooltip");
            tooltip.textContent = tooltipText;
            tooltip.classList.add("show");
        });

        target.addEventListener("mousemove", (event) => {
            const x = event.pageX + 10;
            const y = event.pageY + 10;
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        });

        target.addEventListener("mouseleave", () => {
            tooltip.classList.remove("show");
        });
    });
});  