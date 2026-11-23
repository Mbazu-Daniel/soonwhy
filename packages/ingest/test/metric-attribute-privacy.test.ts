import { describe, expect, it } from "vitest";
import { parseMetricsPayload } from "../src/parse/metrics";
import { mapMetricToRow } from "../src/parse/mappers";

const organization = {
  projectId: "proj_1",
  organizationId: "org_1",
  captureSettings: {
    redactSensitiveData: true,
    captureRequestHeaders: true,
    captureRequestBody: true,
    captureResponseBody: true,
    maxAttributeCount: 100,
    maxAttributeValueLength: 4096,
  },
};

const TIMESTAMP = String(1_700_000_000n * 1_000_000_000n);

const ATTRIBUTES = [
  { key: "customer.email", value: { stringValue: "customer@example.com" } },
  { key: "user.token", value: { stringValue: "secret-token-value" } },
  { key: "payment.card", value: { stringValue: "4111111111111111" } },
  { key: "account.number", value: { stringValue: "123456789" } },
  { key: "db.client.connection.pool.name", value: { stringValue: "primary" } },
  { key: "db.client.connection.state", value: { stringValue: "used" } },
  { key: "http.route", value: { stringValue: "/orders" } },
];

function pointWith(attributes: Array<{ key: string; value: { stringValue: string } }>) {
  const { points } = parseMetricsPayload({
    resourceMetrics: [
      {
        resource: { attributes: [{ key: "service.name", value: { stringValue: "api" } }] },
        scopeMetrics: [
          {
            metrics: [
              {
                name: "orders.count",
                unit: "{order}",
                gauge: { dataPoints: [{ timeUnixNano: TIMESTAMP, asDouble: 3, attributes }] },
              },
            ],
          },
        ],
      },
    ],
  });
  return points[0]!;
}

describe("metric attributes are privacy-protected before storage", () => {
  const secrets = ["customer@example.com", "secret-token-value", "4111111111111111", "123456789"];
  const row = mapMetricToRow(
    pointWith(ATTRIBUTES),
    organization,
  );

  it("never lets a raw sensitive value appear anywhere in the stored row", () => {
    const stored = JSON.stringify(row);
    for (const secret of secrets) expect(stored).not.toContain(secret);
  });

  it("keeps ordinary labels and the connection pool identity", () => {
    expect(row.attributes["http.route"]).toBe("/orders");
    expect(row.attributes["db.client.connection.pool.name"]).toBe("primary");
    expect(row.attributes["db.client.connection.state"]).toBe("used");
    expect(row.connectionPoolName).toBe("primary");
  });

  it("keeps the event id derived from the original attributes, so redeliveries still dedupe", () => {
    const again = mapMetricToRow(
      pointWith(ATTRIBUTES),
      organization,
    );
    expect(again.eventId).toBe(row.eventId);
  });
});
