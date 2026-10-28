import type { AttributeValue, RawAttribute } from "./attribute-types";

export function decodeAttributes(attributes: RawAttribute[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (const attribute of attributes) {
    const key = attribute.key;
    const attributeValue = attribute.value;
    if (!attributeValue) continue;

    if (attributeValue.stringValue !== undefined) {
      output[key] = attributeValue.stringValue;
    } else if (attributeValue.intValue !== undefined) {
      output[key] = attributeValue.intValue.toString();
    } else if (attributeValue.doubleValue !== undefined) {
      output[key] = attributeValue.doubleValue.toString();
    } else if (attributeValue.boolValue !== undefined) {
      output[key] = attributeValue.boolValue ? "true" : "false";
    } else if (attributeValue.arrayValue) {
      output[key] = attributeValue.arrayValue.values
        .map((item) => attributeValueToString(item))
        .join(", ");
    } else if (attributeValue.kvlistValue) {
      output[key] = Object.values(
        decodeAttributes(attributeValue.kvlistValue.values),
      ).join(", ");
    }
  }
  return output;
}

function attributeValueToString(value: AttributeValue): string {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.intValue !== undefined) return value.intValue.toString();
  if (value.doubleValue !== undefined) return value.doubleValue.toString();
  if (value.boolValue !== undefined) return value.boolValue ? "true" : "false";
  return "";
}
