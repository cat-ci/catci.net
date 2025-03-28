document.querySelector('.skip-to-content').addEventListener('click', function (e) {
    setTimeout(() => {
        history.replaceState(null, null, ' ');
    }, 0);
});