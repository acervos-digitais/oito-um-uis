const SEEK_URL = "https://raw.githubusercontent.com/acervos-digitais/oito-um-utils/main/metadata/0801-1152/seek.json";

const VIDEOS_URL = "/videos/0801-500";

const minDate = new Date("2023-01-08T00:00:00-03:00");
const maxDate = new Date("2023-01-08T23:59:59-03:00");

const NUM_VIDS = 32;

function getGridDims(numVideos) {
  const videoArea = (window.innerWidth * window.innerHeight) / numVideos;
  const dimFactor = (videoArea / (16 * 9)) ** 0.5;
  const numCols = Math.round(window.innerWidth / (16 * dimFactor));
  const numRows = Math.ceil(numVideos / numCols);
  return [numCols, numRows];
}

let [NUM_COLS, NUM_ROWS] = getGridDims(NUM_VIDS);

function timeToTimestamp(timeString) {
  const mDate = new Date(minDate);
  const hourMinutes = timeString.split(":").map((v) => parseInt(v));

  mDate.setUTCSeconds(hourMinutes[0] * 3600 + hourMinutes[1] * 60);
  return mDate.getTime() / 1000;
}

function timestampToText(ts) {
  const mDate = new Date(0);
  mDate.setUTCSeconds(ts);
  return mDate.toString();
}

function timestampToPosition(ts, ts0, ts1, pos0, pos1) {
  return ((ts - ts0) / (ts1 - ts0)) * (pos1 - pos0) + pos0;
}

function findFilenamePosition(ts) {
  return function ({ camera, ranges, seeks, ..._ }) {
    let fileName = "";
    let position = -1;

    for (let [ts0, ts1, fName] of ranges) {
      if (ts >= ts0 && ts <= ts1) {
        fileName = fName;
        break;
      }
    }

    if (fileName == "") return { fileName, position };

    const fileSeeks = seeks[fileName];
    let [ts0, pos0] = fileSeeks[0];
    for (let i = 1; i < fileSeeks.length; i++) {
      const [ts1, pos1] = fileSeeks[i];
      if (ts >= ts0 && ts <= ts1) {
        position = timestampToPosition(ts, ts0, ts1, pos0, pos1);
        break;
      } else {
        [ts0, pos0] = fileSeeks[i];
      }
    }

    return { fileName: `${camera}/${fileName}`, position };
  };
}

async function fetchData(mUrl) {
  const response = await fetch(mUrl);
  return await response.json();
}

document.addEventListener("DOMContentLoaded", async (_) => {
  const seekData = await fetchData(SEEK_URL);

  const navContainerEl = document.getElementById("navigation-container");
  const videoContainerEl = document.getElementById("video-container");
  const pickerEl = document.getElementById("timestamp-picker");
  const videoEls = document.getElementsByClassName("video");

  const overlayEl = document.getElementById("overlay");
  const overlayVideoEl = document.getElementById("overlay-video");
  const overlayVideoSrcEl = document.getElementById("overlay-video-source");

  overlayEl.addEventListener("click", () => {
    overlayEl.classList.remove("visible");

    overlayVideoEl.pause();
    overlayVideoSrcEl.setAttribute("src", "");
    overlayVideoEl.load();
  });

  overlayVideoEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
  });

  const videoContainerHeight = window.innerHeight - navContainerEl.clientHeight;
  videoContainerEl.style.height = `${videoContainerHeight}px`;

  pickerEl.setAttribute("value", "00:00");

  function updateVideos(currentTimestamp) {
    const timestampEl = document.getElementById("timestamp-value");
    timestampEl.innerHTML = timestampToText(currentTimestamp);

    Array.from(videoEls).forEach((mVid) => {
      const mCamera = mVid.getAttribute("data-camera");
      const mSrc = mVid.getElementsByClassName("video-source")[0];
      const mSrcSrc = mSrc.getAttribute("src");

      const { fileName, position } = findFilenamePosition(currentTimestamp)(
        seekData[mCamera]
      );

      const newSrcSrc = `${VIDEOS_URL}/${fileName}`;

      mVid.pause();
      if (newSrcSrc != mSrcSrc) {
        mSrc.setAttribute("src", "");
        mVid.removeAttribute("data-position");
        if (fileName != "") {
          mSrc.setAttribute("src", newSrcSrc);
          mVid.setAttribute("data-position", position);
        }
        setTimeout(() => mVid.load(), 200 + Math.random() * 500);
      } else {
        if (position != -1) {
          mVid.setAttribute("data-position", position);
          mVid.currentTime = mVid.getAttribute("data-position") || 0;
        }
      }
    });
  }

  videoContainerEl.innerHTML = "";
  const cameras = Object.keys(seekData);

  for (let i = 0; i < NUM_VIDS; i++) {
    const mVid = document.createElement("video");
    const mSrc = document.createElement("source");

    mVid.classList.add("video");
    mVid.setAttribute("data-camera", cameras[i]);
    mVid.setAttribute("playsinline", "");
    mVid.setAttribute("muted", "");
    mVid.setAttribute("crossorigin", "anonymous");
    mVid.style.width = `${100 / NUM_COLS}%`;
    mVid.style.maxHeight = `${100 / NUM_ROWS}%`;

    mVid.addEventListener("loadeddata", (ev) => {
      // console.log("loaded", cameras[i]);
      const vidEl = ev.target;
      vidEl.currentTime = vidEl.getAttribute("data-position") || 0;
    });

    mVid.addEventListener("click", (ev) => {
      const vidEl = ev.target;
      const srcEl = vidEl.getElementsByClassName("video-source")[0];

      const vidSrc = srcEl.getAttribute("src");
      const vidPos = vidEl.getAttribute("data-position");

      overlayVideoSrcEl.setAttribute("src", vidSrc);
      overlayVideoEl.currentTime = vidPos;
      overlayVideoEl.load();

      overlayEl.classList.add("visible");
    });

    mSrc.classList.add("video-source");
    mSrc.setAttribute("src", "");
    mSrc.setAttribute("type", "video/mp4");

    mVid.appendChild(mSrc);
    videoContainerEl.appendChild(mVid);
  }

  updateVideos(timeToTimestamp(pickerEl.value));

  pickerEl.addEventListener("input", (ev) => {
    updateVideos(timeToTimestamp(ev.target.value));
    ev.target.blur();
  });
});
