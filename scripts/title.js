let timeout;

document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
        timeout = setTimeout(function () {
            document.title = 'bye bye •ᴗ•';
        }, 15000);
    } else {
        clearTimeout(timeout);
        document.title = 'catci';
    }
});