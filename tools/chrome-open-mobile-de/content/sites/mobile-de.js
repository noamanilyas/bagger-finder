// mobile.de adapter. Everything specific to mobile.de search pages lives here:
// selectors, field extraction, and the mapping to the ingest API shape.
(function () {
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

  function textOf(root, selector) {
    const el = root.querySelector(selector);
    return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
  }

  const adapter = {
    id: "mobile.de",

    // Each listing is an <article> that contains a link to its details page.
    listingElements() {
      return [...document.querySelectorAll("article")].filter((article) =>
        article.querySelector('a[href*="details.html"]')
      );
    },

    // Used to tell when the page has changed after a click.
    firstListingKey() {
      const first = adapter.listingElements()[0];
      const link = first && first.querySelector('a[href*="details.html"]');
      return link ? link.getAttribute("href") : null;
    },

    nextButton() {
      return document.querySelector('[data-testid="pagination:next"]');
    },

    previousButton() {
      return document.querySelector('[data-testid="pagination:previous"]');
    },

    // Page indicator text such as "1/4", used for progress messages only.
    pageIndicator() {
      const el = document.querySelector('[class*="mobile-page-indicator"]');
      return el ? el.textContent.trim() : "";
    },

    extractListing(article) {
      const link = article.querySelector('a[href*="details.html"]');
      const titleEl = article.querySelector('[data-testid^="listing-title-"]');
      const priceNet = article.querySelector('[data-testid="price-label"]');
      const priceGross = article.querySelector('[data-testid="price-truck-gross"]');
      const onlineSince = article.querySelector('[data-testid="online-since"]');
      const attributesEl = article.querySelector('[data-testid="listing-details-attributes"]');
      const sellerEl = article.querySelector('[data-testid="seller-info"]');

      // The main photo and the thumbnails all carry "image" in their data-testid.
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
    },

    // Converts one extracted listing to the shape the ingest API expects.
    toMachine(listing) {
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
        source: adapter.id,
      };
    },
  };

  window.Collector.start(adapter);
})();
