// Runs on mobile.de search result pages. Once the page has fully loaded,
// goes through every page of results by clicking "Further", then logs all
// listings as one JSON array to the console. Delays are random:
//   - 5 to 10 seconds before reading each page
//   - 1 to 5 seconds before clicking "Further"
//
// Progress is saved in sessionStorage, so the run keeps its listings even if
// clicking "Further" reloads the page.
(function () {
  const READ_DELAY_MIN_MS = 5000;
  const READ_DELAY_MAX_MS = 10000;
  const CLICK_DELAY_MIN_MS = 1000;
  const CLICK_DELAY_MAX_MS = 5000;
  const PAGE_LOAD_TIMEOUT_MS = 15000;
  const MAX_PAGES = 100; // safety limit
  const STATE_KEY = "mobileDeCollectState";
  const version = chrome.runtime.getManifest().version;
  const BASE_URL = "https://suchen.mobile.de";
  const SITE = "mobile.de";

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Waits a random time between min and max milliseconds.
  const randomDelay = (min, max) => sleep(min + Math.random() * (max - min));

  // Polls until condition() is true or the timeout passes.
  async function waitFor(condition, timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if (condition()) return true;
      await sleep(250);
    }
    return false;
  }

  function loadState() {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveState(state) {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      // Storage unavailable: the run still works on this page load.
    }
  }

  function clearState() {
    try {
      sessionStorage.removeItem(STATE_KEY);
    } catch (e) {
      // Nothing to clear.
    }
  }

  // "€34,000" -> 34000
  function parseEuro(text) {
    const match = text && text.match(/€\s?([\d.,]+)/);
    return match ? Number(match[1].replace(/\D/g, "")) : null;
  }

  // "13,600 operating hours" -> 13600
  function parseNumberBefore(text, label) {
    const match = text && text.match(new RegExp(`([\\d.,]+)\\s*${label}`));
    return match ? Number(match[1].replace(/\D/g, "")) : null;
  }

  function textOf(root, selector) {
    const el = root.querySelector(selector);
    return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
  }

  // Each listing is an <article> that contains a link to its details page.
  function listingArticles() {
    return [...document.querySelectorAll("article")].filter((article) =>
      article.querySelector('a[href*="details.html"]')
    );
  }

  function firstListingUrl() {
    const first = listingArticles()[0];
    const link = first && first.querySelector('a[href*="details.html"]');
    return link ? link.getAttribute("href") : null;
  }

  function extractListing(article) {
    const link = article.querySelector('a[href*="details.html"]');
    const titleEl = article.querySelector('[data-testid^="listing-title-"]');
    const priceNet = article.querySelector('[data-testid="price-label"]');
    const priceGross = article.querySelector('[data-testid="price-truck-gross"]');
    const onlineSince = article.querySelector('[data-testid="online-since"]');
    const attributesEl = article.querySelector('[data-testid="listing-details-attributes"]');
    const sellerEl = article.querySelector('[data-testid="seller-info"]');

    // Images: the main photo and the thumbnails all carry "image" in their data-testid.
    const images = [...article.querySelectorAll('img[data-testid*="image"]')]
      .map((img) => img.getAttribute("src"))
      .filter(Boolean);

    // Attributes look like: "Mobile excavator • Year of manufacture 2010 • 10,694 operating hours"
    const attributeParts = attributesEl
      ? attributesEl.textContent.split("•").map((p) => p.replace(/\s+/g, " ").trim())
      : [];
    const attributeText = attributesEl ? attributesEl.textContent : "";
    const yearMatch = attributeText.match(/Year of manufacture\s*(\d{4})/);

    const ratingLabel = sellerEl && sellerEl.querySelector('[class*="SrOnlyRatingStarsLabel"]');
    const ratingMatch = ratingLabel && ratingLabel.textContent.match(/([\d.,]+)\s*stars/);
    const ratingCountText = sellerEl && textOf(sellerEl, '[class*="ratingCount"]');

    return {
      title: titleEl ? titleEl.getAttribute("title") || titleEl.textContent.trim() : null,
      url: link ? new URL(link.getAttribute("href"), BASE_URL).href : null,
      sponsored: !!article.querySelector('[data-testid="sponsored-badge"]'),
      topListing: !!article.querySelector('[class*="topListingBadge"]'),
      price: {
        netEur: priceNet ? parseEuro(priceNet.textContent) : null,
        grossEur: priceGross ? parseEuro(priceGross.textContent) : null,
      },
      onlineSince: onlineSince
        ? onlineSince.textContent.replace("Ad online since", "").replace(/\s+/g, " ").trim()
        : null,
      machineType: attributeParts[0] || null,
      yearOfManufacture: yearMatch ? Number(yearMatch[1]) : null,
      operatingHours: parseNumberBefore(attributeText, "operating hours"),
      images,
      seller: {
        name: sellerEl ? textOf(sellerEl, '[class*="dealerName"]') : null,
        location: sellerEl ? textOf(sellerEl, '[class*="dealerLocation"]') : null,
        rating: ratingMatch ? Number(ratingMatch[1].replace(",", ".")) : null,
        ratingCount: ratingCountText ? Number(ratingCountText.replace(/\D/g, "")) : null,
      },
    };
  }

  // Page indicator text such as "1/4", used only for progress messages.
  function pageIndicator() {
    const el = document.querySelector('[class*="mobile-page-indicator"]');
    return el ? el.textContent.trim() : "";
  }

  // Adds the listings on the current page to the run state, skipping duplicates.
  // Returns only the listings that were new on this page.
  function readCurrentPage(state) {
    const added = [];
    for (const article of listingArticles()) {
      const listing = extractListing(article);
      if (listing.url && state.seenUrls.includes(listing.url)) continue;
      if (listing.url) state.seenUrls.push(listing.url);
      state.listings.push(listing);
      added.push(listing);
    }
    return added;
  }

  // Converts one extracted listing to the shape the ingest API expects.
  function toMachine(listing) {
    const title = listing.title || "";
    const [make, ...modelWords] = title.split(" ");
    return {
      url: listing.url,
      title,
      make: make || null,
      model: modelWords.join(" ") || null,
      price: listing.price.netEur,
      currency: "EUR",
      year: listing.yearOfManufacture,
      hours: listing.operatingHours,
      location: listing.seller.location,
      imageUrl: listing.images[0] || null,
      source: SITE,
    };
  }

  // Sends one page's listings to the ingest API.
  async function sendPage(listings) {
    if (listings.length === 0) return;
    const body = { site: SITE, machines: listings.map(toMachine) };
    let response;
    try {
      response = await chrome.runtime.sendMessage({ type: "ingest", body });
    } catch (e) {
      console.error("[mobile.de] Ingest request failed:", String(e));
      return;
    }
    if (!response || !response.ok) {
      console.error("[mobile.de] Ingest failed:", response);
      return;
    }
    console.log(`[mobile.de] Sent ${listings.length} listing(s) to the API. Status ${response.status}.`);
  }

  function logFinal(state) {
    console.log(`[mobile.de] Done: ${state.listings.length} listing(s) from ${state.page} page(s).`);
  }

  // Scrolls to the bottom in steps until the page stops growing, so any
  // lazily loaded listings are rendered before they are read.
  async function scrollToEnd() {
    let lastHeight = -1;
    for (let i = 0; i < 50; i++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await randomDelay(800, 1500);
      const height = document.documentElement.scrollHeight;
      if (height === lastHeight) break;
      lastHeight = height;
    }
  }

  // Asks the local API whether this site is due. Returns true only if it is.
  async function checkDue() {
    const site = location.hostname.replace(/^(suchen|www)\./, ""); // "mobile.de"
    console.log(`[mobile.de] Checking whether ${site} is due...`);
    let response;
    try {
      response = await chrome.runtime.sendMessage({ type: "checkDue", site });
    } catch (e) {
      console.error("[mobile.de] Due check failed:", String(e));
      return false;
    }
    if (!response || !response.ok) {
      console.error("[mobile.de] Due check failed:", response && response.error);
      return false;
    }

    const data = response.data;
    console.log("[mobile.de] Due check response:", data);
    if (typeof data === "boolean") return data;
    if (typeof data.due === "boolean") return data.due;
    if (Array.isArray(data)) {
      const entry = data.find((item) => item.site === site || item.name === site);
      return !!(entry && entry.due === true);
    }
    const entry = data[site] ?? (data.sites && data.sites[site]);
    if (typeof entry === "boolean") return entry;
    if (entry && typeof entry.due === "boolean") return entry.due;

    console.error("[mobile.de] Unrecognised due response:", data);
    return false;
  }

  async function run() {
    let state = loadState();
    if (state) {
      console.log(`[mobile.de] Continuing run after page ${state.page}.`);
    } else {
      // Only start, and only log, when the server says this site is due.
      const due = await checkDue();
      console.log(`[mobile.de] Due = ${due}. ${due ? "Starting collection." : "Not starting."}`);
      if (!due) return;
      state = { page: 0, listings: [], seenUrls: [], rewinding: true };
      console.log(`[mobile.de] Extension v${version} is running. Collecting all pages with random delays.`);
      saveState(state);
    }

    // First go back to page 1, in case the site opened on a later page.
    if (state.rewinding) {
      await waitFor(() => listingArticles().length > 0, PAGE_LOAD_TIMEOUT_MS);
      const back = document.querySelector('[data-testid="pagination:previous"]');
      if (back && !back.disabled) {
        console.log(`[mobile.de] Going back to page 1 ${pageIndicator()}`.trim());
        await randomDelay(CLICK_DELAY_MIN_MS, CLICK_DELAY_MAX_MS);
        const previousFirst = firstListingUrl();
        saveState(state);
        back.click();
        const changed = await waitFor(() => firstListingUrl() !== previousFirst, PAGE_LOAD_TIMEOUT_MS);
        if (!changed) {
          console.log("[mobile.de] Previous page did not load. Starting from the current page.");
          state.rewinding = false;
          saveState(state);
        }
        return run();
      }
      state.rewinding = false;
      saveState(state);
    }

    while (state.page < MAX_PAGES) {
      await waitFor(() => listingArticles().length > 0, PAGE_LOAD_TIMEOUT_MS);
      await scrollToEnd();
      await randomDelay(READ_DELAY_MIN_MS, READ_DELAY_MAX_MS);

      state.page += 1;
      readCurrentPage(state);
      console.log(`[mobile.de] Read page ${state.page} ${pageIndicator()}`.trim());

      const next = document.querySelector('[data-testid="pagination:next"]');
      if (!next || next.disabled) break;

      await randomDelay(CLICK_DELAY_MIN_MS, CLICK_DELAY_MAX_MS);
      const previousFirst = firstListingUrl();
      saveState(state);
      next.click();

      // If the page reloads, this script stops here and run() resumes from
      // the saved state on the next load.
      const changed = await waitFor(() => firstListingUrl() !== previousFirst, PAGE_LOAD_TIMEOUT_MS);
      if (!changed) {
        console.log("[mobile.de] Next page did not load. Stopping.");
        break;
      }
    }

    // Send everything in one request, after all pages are done.
    await sendPage(state.listings);
    clearState();
    logFinal(state);
  }

  if (document.readyState === "complete") {
    run();
  } else {
    window.addEventListener("load", run, { once: true });
  }
})();
