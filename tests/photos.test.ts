import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { largePhoto } from "../lib/photos";

describe("largePhoto", () => {
  it("asks each site for its bigger copy", () => {
    assert.equal(largePhoto("https://photo.static-viamobilis.com/1/1/10453758_th.jpg"), "https://photo.static-viamobilis.com/1/1/10453758.jpg");
    assert.equal(
      largePhoto("https://img.kleinanzeigen.de/api/v1/prod-ads/images/91/abc?rule=$_2.AUTO"),
      "https://img.kleinanzeigen.de/api/v1/prod-ads/images/91/abc?rule=$_57.AUTO",
    );
    assert.equal(
      largePhoto("https://dnge9sb91helb.cloudfront.net/image/product/cust/350/250/ff41c35d/robex,81363489.jpg"),
      "https://dnge9sb91helb.cloudfront.net/image/product/cust/1200/900/ff41c35d/robex,81363489.jpg",
    );
  });

  it("leaves other addresses alone", () => {
    for (const url of [
      "https://www.truck1.eu/img/xxl/44025/Doosan_44025_1.jpg",
      "https://cdn.truckscout24.com/data/listing/img/vga/ts/26/85/22623132-01.jpg?v=1",
      "https://img.linemedia.com/img/s/Doosan-DX-55-W---17_common--26.jpg",
      "https://example.com/machine_th.jpg",
    ]) {
      assert.equal(largePhoto(url), url);
    }
  });
});
