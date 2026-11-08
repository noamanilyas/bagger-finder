// Runs on mobile.de search result pages. Once the page has fully loaded,
// waits 10 seconds, then logs every listing as JSON to the console.
(function () {
  const DELAY_MS = 10000;
  const version = chrome.runtime.getManifest().version;
  const BASE_URL = "https://suchen.mobile.de";

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

  function text(root, selector) {
    const el = root.querySelector(selector);
    return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
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
    const ratingCountText = sellerEl && text(sellerEl, '[class*="ratingCount"]');

    return {
      title: titleEl ? titleEl.getAttribute("title") || titleEl.textContent.trim() : null,
      url: link ? new URL(link.getAttribute("href"), BASE_URL).href : null,
      sponsored: !!article.querySelector('[data-testid="sponsored-badge"]'),
      topListing: !!article.querySelector('[class*="topListingBadge"]'),
      price: {
        netEur: priceNet ? parseEuro(priceNet.textContent) : null,
        grossEur: priceGross ? parseEuro(priceGross.textContent) : null,
      },
      onlineSince: onlineSince ? onlineSince.textContent.replace("Ad online since", "").replace(/\s+/g, " ").trim() : null,
      machineType: attributeParts[0] || null,
      yearOfManufacture: yearMatch ? Number(yearMatch[1]) : null,
      operatingHours: parseNumberBefore(attributeText, "operating hours"),
      images,
      seller: {
        name: sellerEl ? text(sellerEl, '[class*="dealerName"]') : null,
        location: sellerEl ? text(sellerEl, '[class*="dealerLocation"]') : null,
        rating: ratingMatch ? Number(ratingMatch[1].replace(",", ".")) : null,
        ratingCount: ratingCountText ? Number(ratingCountText.replace(/\D/g, "")) : null,
      },
    };
  }

  function logListings() {
    // Each listing is an <article> that contains a link to its details page.
    const listings = [...document.querySelectorAll("article")]
      .filter((article) => article.querySelector('a[href*="details.html"]'))
      .map(extractListing);

    console.log(
      `[mobile.de] ${listings.length} listing(s) as JSON:\n` + JSON.stringify(listings, null, 2)
    );
  }

  function start() {
    console.log(`[mobile.de] Extension v${version} is running. Listings will be logged in 10 seconds.`);
    setTimeout(logListings, DELAY_MS);
  }

  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start, { once: true });
  }
})();
