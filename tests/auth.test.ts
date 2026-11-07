import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedUser, parseAllowedEmails } from "../lib/auth";

describe("parseAllowedEmails", () => {
  it("trims, lowercases and skips blanks", () => {
    assert.deepEqual([...parseAllowedEmails(" A@x.com, ,b@x.com,")], ["a@x.com", "b@x.com"]);
  });

  it("is empty without a value", () => {
    assert.equal(parseAllowedEmails(undefined).size, 0);
    assert.equal(parseAllowedEmails("").size, 0);
  });
});

describe("isAllowedUser", () => {
  const allowed = parseAllowedEmails("buyer@x.com");

  it("lets in a verified address on the list, whatever its case", () => {
    assert.equal(isAllowedUser({ email: "Buyer@X.com", emailVerified: true }, allowed), true);
  });

  it("refuses an address that is not on the list", () => {
    assert.equal(isAllowedUser({ email: "other@x.com", emailVerified: true }, allowed), false);
  });

  it("refuses an unverified address, even on the list", () => {
    assert.equal(isAllowedUser({ email: "buyer@x.com", emailVerified: false }, allowed), false);
  });

  it("refuses everyone when the list is empty", () => {
    assert.equal(isAllowedUser({ email: "buyer@x.com", emailVerified: true }, new Set()), false);
  });
});
