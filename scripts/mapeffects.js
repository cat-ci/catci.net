document.addEventListener("DOMContentLoaded", function () {
            const img = document.querySelector(".map img");

            if (img) {
                fetch(img.src)
                    .then(response => response.text())
                    .then(svgText => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(svgText, "image/svg+xml");
                        const svgElement = doc.documentElement;

                        svgElement.querySelectorAll("*").forEach(el => {
                            el.setAttribute("fill", "rgb(255, 255, 255)");
                            el.setAttribute("fill-opacity", "1");
                        });

                        const positionElement = svgElement.querySelector("#position");
                        if (positionElement) {
                            positionElement.querySelectorAll("*").forEach(el => {
                                el.setAttribute("fill", "rgb(202, 55, 68)");
                                el.setAttribute("fill-opacity", "1");
                            });
                        }

                        img.replaceWith(svgElement);
                    })
                    .catch(error => console.error("Error loading SVG:", error));
            }
        });