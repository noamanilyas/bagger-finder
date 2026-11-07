/**
 * The scraper stores the small photo from a site's search results. Some sites keep a bigger copy at a predictable
 * address. Other sites are unchanged: Truck1 and TruckScout24 already store a big one, Machineryline has no bigger one there.
 */
export function largePhoto(url: string): string {
  return url
    .replace(/^(https:\/\/photo\.static-viamobilis\.com\/.+)_th\.jpg$/, "$1.jpg")
    .replace(/^(https:\/\/img\.kleinanzeigen\.de\/.+[?&]rule=\$_)\d+\./, "$157.")
    .replace(/(\/image\/product\/cust\/)\d+\/\d+\//, "$11200/900/");
}
