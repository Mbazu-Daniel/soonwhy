import { describe, expect, it } from "vitest";
import { isPiiKey } from "../src/privacy/pii";

describe("isPiiKey", () => {
  it.each([
    "account.number",
    "customer_account_no",
    "billing.accountNum",
    "bank.account",
    "payer.iban",
    "routing_number",
    "sort-code",
    "customer.email",
  ])("treats %s as personal data", (key) => {
    expect(isPiiKey(key)).toBe(true);
  });

  it.each([
    "cloud.account.id",
    "http.route",
    "db.client.connection.state",
    "accounting.period",
    "notional.amount",
  ])("leaves %s alone", (key) => {
    expect(isPiiKey(key)).toBe(false);
  });
});
