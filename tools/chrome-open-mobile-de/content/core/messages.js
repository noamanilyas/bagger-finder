// Messages to the background worker, which owns the local API.
(function () {
  window.Collector = window.Collector || {};

  async function send(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  window.Collector.messages = {
    // Returns { due, urls } for a site. Treated as not due if the check fails.
    async checkDue(site) {
      console.log(`[${site}] Checking whether ${site} is due...`);
      const response = await send({ type: "checkDue", site });
      if (!response || !response.ok) {
        console.error(`[${site}] Due check failed:`, response && response.error);
        return { due: false, urls: [] };
      }
      return { due: response.due, urls: response.urls || [] };
    },

    // Sends one site's listings to the ingest API in a single request.
    async ingest(site, machines) {
      if (machines.length === 0) {
        console.log(`[${site}] No listings to send.`);
        return;
      }
      const response = await send({ type: "ingest", site, machines });
      if (!response || !response.ok) {
        console.error(`[${site}] Ingest failed:`, response);
        return;
      }
      console.log(`[${site}] Sent ${machines.length} listing(s) to the API. Status ${response.status}.`);
    },
  };
})();
