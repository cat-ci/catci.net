const audio = document.getElementById('ambience');

audio.volume = 0.02;

const playAudioOnFirstClick = () => {
    if (audio && typeof audio.play === 'function') {
        audio.play().catch((error) => {
            console.error('Error playing audio:', error);
        });
    } else {
        console.error('Audio element is not properly initialized.');
    }

    document.removeEventListener('click', playAudioOnFirstClick);
};

document.addEventListener('click', playAudioOnFirstClick);