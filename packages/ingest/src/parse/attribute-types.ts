export interface AttributeValue {
  stringValue?: string;
  intValue?: number;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: AttributeValue[] };
  kvlistValue?: KvListValue;
}

export interface KvListValue {
  values: RawAttribute[];
}

export interface RawAttribute {
  key: string;
  value: AttributeValue;
}
