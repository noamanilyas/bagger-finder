// Shared helpers for every site content script.
// Everything hangs off window.Collector so the core and site files can share it.
(function () {
  window.Collector = window.Collector || {};

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Waits a random time between min and max milliseconds.
  const randomDelay = (min, max) => sleep(min + Math.random() * (max - min));

  // Polls until condition() is true or the timeout passes. Resolves true if it became true.
  async function waitFor(condition, timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if (condition()) return true;
      await sleep(250);
    }
    return false;
  }

  window.Collector.util = { sleep, randomDelay, waitFor };
})();
