const apiKey = "B371C56A435252AF87048217D6853896";
      const steamId = "76561199573919413";

      const ONLINE_SUFFIX = ".ᐟ";
      const SLEEPING_SUFFIX = " ᶻ 𝗓 𐰁 .ᐟ";

      const steamStates = {
        0: `Offline${SLEEPING_SUFFIX}`,
        1: `Online${ONLINE_SUFFIX}`,
        2: `Busy${ONLINE_SUFFIX}`,
        3: `Away${SLEEPING_SUFFIX}`,
        4: `Snooze${SLEEPING_SUFFIX}`,
        5: `Looking to Trade${ONLINE_SUFFIX}`,
        6: `Looking to Play${ONLINE_SUFFIX}`,
        7: `Invisible${SLEEPING_SUFFIX}`
      };

      function getStatusCategory(personastate) {
        if ([1, 2, 5, 6].includes(personastate)) {
          return { status: steamStates[personastate], class: "online" };
        }
        if ([3, 4].includes(personastate)) {
          return { status: steamStates[personastate], class: "away" };
        }
        return {
          status: steamStates[personastate] || `Offline${SLEEPING_SUFFIX}`,
          class: "offline"
        };
      }

      function generateRandomString() {
        return Math.random().toString(36).substring(7);
      }

      function saveStatusToLocalStorage(status, className) {
        localStorage.setItem(
          "steamStatus",
          JSON.stringify({ status, className, timestamp: Date.now() })
        );
      }

      function getLastKnownStatus() {
        const saved = localStorage.getItem("steamStatus");
        return saved ? JSON.parse(saved) : null;
      }

      function updateStatusDisplay(status, className) {
        const statusElement = document.getElementById("steamStatus");
        statusElement.textContent = status;
        statusElement.className = `status ${className}`;
        saveStatusToLocalStorage(status, className);
      }

      async function getStatus() {
        try {
          const apiUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`;
          const corsProxy = "https://api.allorigins.win/get?url=";
          const noCacheUrl = `${corsProxy}${encodeURIComponent(
            apiUrl
          )}&nocache=${generateRandomString()}`;

          const response = await fetch(noCacheUrl);
          const rawData = await response.text();
          const data = JSON.parse(rawData);

          if (data.contents) {
            const steamData = JSON.parse(data.contents);
            const player = steamData.response.players[0];
            console.log("Current persona state:", player.personastate);
            
            const statusInfo = getStatusCategory(player.personastate);
            updateStatusDisplay(statusInfo.status, statusInfo.class);
          }
        } catch (error) {
          console.error("Error details:", error);
          const lastKnown = getLastKnownStatus();
          if (lastKnown) {
            updateStatusDisplay(lastKnown.status, lastKnown.className);
          } else {
            updateStatusDisplay(`Offline${SLEEPING_SUFFIX}`, "offline");
          }
        }
      }

      const lastKnown = getLastKnownStatus();
      if (lastKnown) {
        updateStatusDisplay(lastKnown.status, lastKnown.className);
      }

      getStatus();

      setInterval(getStatus, 30000);