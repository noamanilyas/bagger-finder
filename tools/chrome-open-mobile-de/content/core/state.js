// Run progress, saved in sessionStorage so it survives page reloads and
// navigation inside the same tab. One saved run per site.
(function () {
  window.Collector = window.Collector || {};

  const keyFor = (site) => `collector:${site}`;

  window.Collector.state = {
    load(site) {
      try {
        const raw = sessionStorage.getItem(keyFor(site));
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    save(site, job) {
      try {
        sessionStorage.setItem(keyFor(site), JSON.stringify(job));
      } catch (e) {
        // Storage unavailable: the run still continues on this page load.
      }
    },

    clear(site) {
      try {
        sessionStorage.removeItem(keyFor(site));
      } catch (e) {
        // Nothing to clear.
      }
    },
  };
})();
