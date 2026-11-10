// ===== NASA Space Explorer =====
// Gets Astronomy Picture of the Day (APOD) entries from NASA's API and shows them in a gallery.

// ----- Settings -----
const API_URL = "https://api.nasa.gov/planetary/apod";
const API_KEY = "DEMO_KEY"; // NASA's free demo key (no sign up needed)
const SAMPLE_DATA_URL = "https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json"; // backup data if NASA's API is down
const MAX_DAYS = 31; // longest date range we allow at once

// ----- Page elements -----
const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");
const getImagesBtn = document.getElementById("getImagesBtn");
const gallery = document.getElementById("gallery");
const noticeEl = document.getElementById("notice");

const modal = document.getElementById("modal");
const modalClose = document.getElementById("modal-close");
const modalMedia = document.getElementById("modal-media");
const modalTitle = document.getElementById("modal-title");
const modalDate = document.getElementById("modal-date");
const modalCredit = document.getElementById("modal-credit");
const modalExplanation = document.getElementById("modal-explanation");

// Set up the date pickers (this function comes from dateRange.js)
setupDateInputs(startInput, endInput);

// ----- LevelUp: random "Did You Know?" space fact -----
const spaceFacts = [
  "A day on Venus is longer than its year. Venus spins so slowly that one rotation takes about 243 Earth days, but it circles the Sun in about 225.",
  "The Sun holds about 99.8% of all the mass in our solar system.",
  "Light from the Sun takes about 8 minutes and 20 seconds to reach Earth.",
  "A teaspoon of neutron star material would weigh billions of tons.",
  "Space is silent. Sound needs air or another material to travel through, and space is almost empty.",
  "Saturn is so light for its size that its average density is lower than water.",
  "Footprints left on the Moon can last for millions of years because there is no wind or rain to wipe them away.",
  "Voyager 1 launched in 1977 and is now in interstellar space, farther from Earth than any other human-made object.",
  "The Milky Way galaxy has somewhere between 100 and 400 billion stars.",
  "Olympus Mons on Mars is the tallest known volcano in the solar system, about two and a half times as tall as Mount Everest.",
  "A year on Mercury lasts only 88 Earth days.",
  "Astronauts can grow up to about 2 inches taller in space because their spines stretch out without gravity pressing down.",
  "Jupiter's Great Red Spot is a giant storm wider than Earth that people have been watching for well over a century.",
  "Mercury and Venus are the only planets in our solar system with no moons.",
];

const factEl = document.getElementById("space-fact");
factEl.textContent = spaceFacts[Math.floor(Math.random() * spaceFacts.length)];

// ----- Small helpers -----
function showNotice(text, type) {
  noticeEl.textContent = text;
  noticeEl.className = "notice" + (type ? " " + type : "");
  noticeEl.hidden = false;
}
function hideNotice() {
  noticeEl.hidden = true;
  noticeEl.textContent = "";
}

// Number of days from start to end (inclusive)
function daysBetween(start, end) {
  const a = Date.UTC(...start.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  const b = Date.UTC(...end.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  return Math.round((b - a) / 86400000) + 1;
}

// "2025-10-01" -> "October 1, 2025" (done by hand so time zones can't shift the day)
function formatDate(dateString) {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [y, m, d] = dateString.split("-").map(Number);
  return months[m - 1] + " " + d + ", " + y;
}

// Gets the video id from a YouTube embed link
function youtubeId(url) {
  const match = /youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/.exec(url || "");
  return match ? match[1] : null;
}

// NASA's API sometimes returns a generic NASA logo instead of a real picture
function isPlaceholder(item) {
  return /nasa-logo/i.test(item.url || "") || /nasa-logo/i.test(item.hdurl || "");
}

// ----- Loading message -----
function showLoading() {
  gallery.innerHTML = "";
  const box = document.createElement("div");
  box.className = "loading";
  const spin = document.createElement("span");
  spin.className = "spin";
  spin.textContent = "🔄";
  box.append(spin, " Loading space photos…");
  gallery.appendChild(box);
}

// ----- Getting the data -----
async function fetchFromNasa(start, end) {
  const url = API_URL + "?api_key=" + API_KEY + "&start_date=" + start + "&end_date=" + end;
  const response = await fetch(url);
  if (!response.ok) {
    const err = new Error("NASA API error " + response.status);
    err.status = response.status;
    throw err;
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [data];
}

// Backup: a small sample of real APOD entries saved by the class
async function fetchSample(start, end) {
  const response = await fetch(SAMPLE_DATA_URL);
  if (!response.ok) throw new Error("Sample data error");
  const all = await response.json();
  const inRange = all.filter((item) => item.date >= start && item.date <= end);
  return { items: inRange.length ? inRange : all, exact: inRange.length > 0 };
}

async function loadGallery() {
  const start = startInput.value;
  const end = endInput.value;

  // Check the dates before calling the API
  if (!start || !end) {
    showNotice("Please choose both a start date and an end date.", "error");
    return;
  }
  if (end < start) {
    showNotice("The end date has to be on or after the start date.", "error");
    return;
  }
  if (daysBetween(start, end) > MAX_DAYS) {
    showNotice("Please pick a range of " + MAX_DAYS + " days or less so the gallery loads quickly.", "error");
    return;
  }

  hideNotice();
  getImagesBtn.disabled = true;
  showLoading();

  let items = [];
  let message = "";
  let messageType = "";

  try {
    items = await fetchFromNasa(start, end);
  } catch (error) {
    // NASA's API failed (for example too many requests), so try the backup data
    try {
      const sample = await fetchSample(start, end);
      items = sample.items;
      message = error.status === 429
        ? "NASA's demo key has hit its hourly limit, so these are sample entries. Wait a bit and try again for your dates."
        : "NASA's server could not be reached right now, so these are sample entries.";
      messageType = "";
    } catch (backupError) {
      gallery.innerHTML = "";
      showNotice("Sorry, we could not load space photos right now. Please check your connection and try again.", "error");
      getImagesBtn.disabled = false;
      return;
    }
  }

  // Newest pictures first
  items.sort((a, b) => (a.date < b.date ? 1 : -1));

  if (message === "" && items.length > 0 && items.every(isPlaceholder)) {
    message = "NASA's API is currently sending a generic NASA logo for these dates instead of the real pictures. This is on NASA's side. The gallery will fill with real photos once their feed is fixed.";
  }

  renderGallery(items);
  if (message) showNotice(message, messageType);
  getImagesBtn.disabled = false;
}

// ----- Showing the gallery -----
function createThumb(item) {
  const thumb = document.createElement("div");
  thumb.className = "thumb";

  let src = item.url;
  const isVideo = item.media_type === "video";

  // LevelUp: video entries show a thumbnail with a Video badge
  if (isVideo) {
    const id = youtubeId(item.url);
    src = item.thumbnail_url || (id ? "https://img.youtube.com/vi/" + id + "/hqdefault.jpg" : "");
  }

  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = isVideo ? "Video thumbnail: " + item.title : item.title;
    img.loading = "lazy";
    if (isPlaceholder(item)) img.classList.add("contain");
    // If a picture can't load, show a star instead so the card still works
    img.addEventListener("error", () => {
      img.remove();
      const fallback = document.createElement("div");
      fallback.className = "no-image";
      fallback.setAttribute("aria-hidden", "true");
      fallback.textContent = isVideo ? "▶" : "✨";
      thumb.appendChild(fallback);
    });
    thumb.appendChild(img);
  } else {
    const fallback = document.createElement("div");
    fallback.className = "no-image";
    fallback.setAttribute("aria-hidden", "true");
    fallback.textContent = "▶";
    thumb.appendChild(fallback);
  }

  if (isVideo) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "▶ Video";
    thumb.appendChild(badge);
  }
  return thumb;
}

function renderGallery(items) {
  gallery.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "placeholder";
    empty.innerHTML = '<div class="placeholder-icon">🌌</div><p>No space photos found for those dates. Try a different range.</p>';
    gallery.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    // A button so keyboard users can open it too
    const card = document.createElement("button");
    card.type = "button";
    card.className = "gallery-item";
    card.setAttribute("aria-label", "Open details for " + item.title + ", " + formatDate(item.date));

    const text = document.createElement("div");
    text.className = "card-text";
    const title = document.createElement("h3");
    title.textContent = item.title;
    const date = document.createElement("p");
    date.textContent = formatDate(item.date);
    text.append(title, date);

    card.append(createThumb(item), text);
    card.addEventListener("click", () => openModal(item, card));
    gallery.appendChild(card);
  });
}

// ----- Modal -----
let lastFocused = null;

function openModal(item, openerButton) {
  lastFocused = openerButton;
  modalMedia.innerHTML = "";

  if (item.media_type === "video") {
    // LevelUp: embed YouTube videos, or give a clear link for other video types
    const id = youtubeId(item.url);
    if (id) {
      const wrap = document.createElement("div");
      wrap.className = "video-wrap";
      const frame = document.createElement("iframe");
      frame.src = "https://www.youtube.com/embed/" + id;
      frame.title = item.title;
      frame.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture";
      frame.allowFullscreen = true;
      wrap.appendChild(frame);
      modalMedia.appendChild(wrap);
    } else {
      const box = document.createElement("p");
      box.className = "video-link";
      box.append("This entry is a video. ");
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Watch it on NASA's page (opens in a new tab)";
      box.appendChild(link);
      modalMedia.appendChild(box);
    }
  } else {
    const img = document.createElement("img");
    img.src = item.hdurl || item.url; // larger version for the modal
    img.alt = item.title;
    img.addEventListener("error", () => {
      // If the big version fails, try the normal one
      if (img.src !== item.url && item.url) img.src = item.url;
    });
    modalMedia.appendChild(img);
  }

  modalTitle.textContent = item.title;
  modalDate.textContent = formatDate(item.date);
  if (item.copyright) {
    modalCredit.textContent = "Image credit: " + item.copyright.replace(/\s+/g, " ").trim();
    modalCredit.hidden = false;
  } else {
    modalCredit.hidden = true;
  }
  modalExplanation.textContent = (item.explanation || "").replace(/\s+/g, " ").trim();

  modal.hidden = false;
  document.body.classList.add("modal-open");
  modalClose.focus();
}

function closeModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  modalMedia.innerHTML = ""; // also stops any playing video
  if (lastFocused) lastFocused.focus();
}

modalClose.addEventListener("click", closeModal);
// Clicking the dark background closes it
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});
// Escape closes it, and Tab stays inside the modal
document.addEventListener("keydown", (event) => {
  if (modal.hidden) return;
  if (event.key === "Escape") closeModal();
  if (event.key === "Tab") {
    const focusable = modal.querySelectorAll("button, a[href], iframe");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

// ----- Button -----
getImagesBtn.addEventListener("click", loadGallery);
