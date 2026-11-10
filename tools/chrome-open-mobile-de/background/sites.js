// Site registry. Each site lists the search pages to collect from, in order.
// The key must match the site id used by its content script (content/sites/).
//
// To add a site, see README.md.
export const SITES = {
  "mobile.de": {
    name: "mobile.de",
    urls: [
      "https://suchen.mobile.de/fahrzeuge/search.html?c=MobileDigger&isSearchRequest=true&ms=102&ms=6800&ms=11600&ms=10700&ms=12500&ms=26100&ms=3600&np=%3A50000&s=Truck&vc=ConstructionMachine",
    ],
  },
};
