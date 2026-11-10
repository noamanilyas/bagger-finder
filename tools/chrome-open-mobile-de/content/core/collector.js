// Generic run engine. A site's adapter (content/sites/*.js) describes how its
// pages are laid out. This file holds only the run logic:
//
//   due check -> first URL -> rewind to page 1 -> scroll and read each page
//   -> click Further -> next URL -> ... -> one send for all URLs -> reschedule
(function () {
  window.Collector = window.Collector || {};
  const { util, state, messages } = window.Collector;

  const READ_DELAY_MS = [5000, 10000];
  const CLICK_DELAY_MS = [1000, 5000];
  const PAGE_LOAD_TIMEOUT_MS = 15000;
  const MAX_PAGES_PER_URL = 100; // safety limit
  const version = chrome.runtime.getManifest().version;

  // Scrolls to the bottom in steps until the page stops growing.
  async function scrollToEnd() {
    let lastHeight = -1;
    for (let i = 0; i < 50; i++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await util.randomDelay(800, 1500);
      const height = document.documentElement.scrollHeight;
      if (height === lastHeight) break;
      lastHeight = height;
    }
  }

  // Adds the listings on this page to the job, skipping URLs already seen.
  function readPage(adapter, job) {
    for (const element of adapter.listingElements()) {
      const listing = adapter.extractListing(element);
      if (listing.url && job.seenUrls.includes(listing.url)) continue;
      if (listing.url) job.seenUrls.push(listing.url);
      job.listings.push(listing);
    }
  }

  // Clicks Back until page 1, if the site did not open on page 1.
  // Returns true if the page changed, so the caller should re-enter.
  async function rewind(adapter, job) {
    const site = adapter.id;
    const back = adapter.previousButton();
    if (!back || back.disabled) return false;

    console.log(`[${site}] Going back to page 1 ${adapter.pageIndicator()}`.trim());
    await util.randomDelay(CLICK_DELAY_MS[0], CLICK_DELAY_MS[1]);
    const before = adapter.firstListingKey();
    state.save(site, job);
    back.click();

    const changed = await util.waitFor(() => adapter.firstListingKey() !== before, PAGE_LOAD_TIMEOUT_MS);
    if (!changed) console.log(`[${site}] Previous page did not load. Starting from the current page.`);
    return changed;
  }

  async function collect(adapter) {
    const site = adapter.id;
    let job = state.load(site);

    if (!job) {
      const check = await messages.checkDue(site);
      if (!check.due) {
        console.log(`[${site}] Due = false. Not starting.`);
        return;
      }
      if (check.urls.length === 0) {
        console.error(`[${site}] Due = true, but no search URLs are configured for this site.`);
        return;
      }

      console.log(`[${site}] Due = true. Starting collection.`);
      console.log(
        `[${site}] Extension v${version} is running. Collecting ${check.urls.length} URL(s) with random delays.`
      );
      job = { urls: check.urls, urlIndex: 0, page: 0, rewinding: true, listings: [], seenUrls: [] };
      state.save(site, job);

      // Start on the first configured URL, unless we are already there.
      if (location.href !== job.urls[0]) {
        location.href = job.urls[0];
        return;
      }
    } else {
      console.log(`[${site}] Continuing: URL ${job.urlIndex + 1}/${job.urls.length}, page ${job.page}.`);
    }

    await util.waitFor(() => adapter.listingElements().length > 0, PAGE_LOAD_TIMEOUT_MS);

    if (job.rewinding) {
      const moved = await rewind(adapter, job);
      if (moved) return collect(adapter);
      job.rewinding = false;
      state.save(site, job);
    }

    while (job.page < MAX_PAGES_PER_URL) {
      await util.waitFor(() => adapter.listingElements().length > 0, PAGE_LOAD_TIMEOUT_MS);
      await scrollToEnd();
      await util.randomDelay(READ_DELAY_MS[0], READ_DELAY_MS[1]);

      job.page += 1;
      readPage(adapter, job);
      console.log(`[${site}] Read page ${job.page} ${adapter.pageIndicator()}`.trim());
      state.save(site, job);

      const next = adapter.nextButton();
      if (!next || next.disabled) break;

      await util.randomDelay(CLICK_DELAY_MS[0], CLICK_DELAY_MS[1]);
      const before = adapter.firstListingKey();
      state.save(site, job);
      next.click();

      // If the page reloads, this script stops here and collect() resumes from the saved job.
      const changed = await util.waitFor(() => adapter.firstListingKey() !== before, PAGE_LOAD_TIMEOUT_MS);
      if (!changed) {
        console.log(`[${site}] Next page did not load. Ending this URL.`);
        break;
      }
    }

    // This URL is finished. Move on to the next one.
    if (job.urlIndex + 1 < job.urls.length) {
      job.urlIndex += 1;
      job.page = 0;
      job.rewinding = true;
      state.save(site, job);
      console.log(`[${site}] Moving to URL ${job.urlIndex + 1}/${job.urls.length}.`);
      location.href = job.urls[job.urlIndex];
      return;
    }

    // Every URL is finished: send everything in one request, then reschedule.
    await messages.ingest(site, job.listings.map((listing) => adapter.toMachine(listing)));
    state.clear(site);
    console.log(`[${site}] Done: ${job.listings.length} listing(s) from ${job.urls.length} URL(s).`);
    await messages.checkDue(site);
  }

  // Called by each site's content script with its adapter.
  window.Collector.start = (adapter) => {
    const begin = () => {
      collect(adapter).catch((error) => console.error(`[${adapter.id}] Run failed:`, error));
    };
    if (document.readyState === "complete") begin();
    else window.addEventListener("load", begin, { once: true });
  };
})();
