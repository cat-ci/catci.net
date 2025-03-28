const apiUrl =
  "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=cat-ci&api_key=3b559041ed6faf7a5faf30a491b56026&format=json";

async function fetchSongData() {
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    const recentTrack = data.recenttracks.track[0];

    const songName = recentTrack.name;
    const artistName = recentTrack.artist["#text"];
    const albumArt = recentTrack.image[2]["#text"]; 
    const nowPlaying = recentTrack["@attr"]?.nowplaying === "true";
    const playedTime = nowPlaying
      ? "Now Playing"
      : `Last Played`;

    let timeInfo = "";
    if (!nowPlaying && recentTrack.date) {
      const playedTimestamp = parseInt(recentTrack.date.uts) * 1000;
      const timeElapsed = Date.now() - playedTimestamp;
      const hours = Math.floor(timeElapsed / (1000 * 60 * 60));
      const minutes = Math.floor((timeElapsed % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        timeInfo = `Played ${hours} hour${hours === 1 ? "" : "s"} ago`;
      } else {
        timeInfo = `Played ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
      }
    } else {
      timeInfo = "Currently playing";
    }

    document.getElementById("status").textContent = playedTime;
    document.getElementById("album-art").src = albumArt || "placeholder.jpg";
    document.getElementById("song-info").textContent = `${songName} by ${artistName}`;
    document.getElementById("time-info").textContent = timeInfo;

    const orb = document.getElementById("orb");
    if (nowPlaying) {
      orb.classList.add("blinking");
    } else {
      orb.classList.remove("blinking");
      orb.style.backgroundColor = "gray";
    }
  } catch (error) {
    console.error("Error fetching song data:", error);
    document.getElementById("status").textContent = "Error loading song data.";
    document.getElementById("song-info").textContent = "";
    document.getElementById("time-info").textContent = "";
    const orb = document.getElementById("orb");
    orb.classList.remove("blinking");
    orb.style.backgroundColor = "gray";
  }
}

document.getElementById("orb").style.backgroundColor = "gray";

fetchSongData();
setInterval(fetchSongData, 5000);