from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Optional, Tuple

DEFAULT_ENDPOINT = "http://localhost:3002/v1"
SDK_VERSION = "0.1.0"

@dataclass
class SoonwhyOptions:
    api_key: str
    endpoint: str = DEFAULT_ENDPOINT
    service_name: Optional[str] = None
    service_version: Optional[str] = None
    deployment_environment: Optional[str] = None
    attributes: Mapping[str, Any] = field(default_factory=dict)
    max_retries: int = 3
    timeout: float = 10.0

class Soonwhy:
    def __init__(self, options: SoonwhyOptions) -> None:
        if not options.api_key.strip():
            raise ValueError("Soonwhy api_key is required")
        endpoint = options.endpoint.strip().rstrip("/")
        if not endpoint.startswith(("http://", "https://")):
            raise ValueError("Soonwhy endpoint must use http or https")
        if options.max_retries < 0:
            raise ValueError("Soonwhy max_retries must be non-negative")
        if options.timeout <= 0:
            raise ValueError("Soonwhy timeout must be positive")

        self.options = options
        self.options.endpoint = endpoint
        self._logs: List[Dict[str, Any]] = []
        self._metrics: List[Dict[str, Any]] = []

    def capture_log(
        self,
        message: str,
        level: str = "info",
        **attributes: Any,
    ) -> None:
        self._logs.append(
            {
                "level": level,
                "message": message,
                "timeUnixNano": str(time.time_ns()),
                "attributes": attributes,
            }
        )

    def capture_error(self, error: BaseException, **attributes: Any) -> None:
        error_attributes = {
            **attributes,
            "exception.type": type(error).__name__,
        }
        if error.__traceback__ is not None:
            import traceback
            error_attributes["exception.stacktrace"] = "".join(
                traceback.format_exception(type(error), error, error.__traceback__)
            )

        self.capture_log(
            str(error),
            level="error",
            **error_attributes,
        )

    def capture_metric(
        self,
        name: str,
        value: float,
        unit: Optional[str] = None,
        **attributes: Any,
    ) -> None:
        if not isinstance(value, (int, float)) or not isinstance(value, bool):
            if not isinstance(value, (int, float)):
                raise ValueError("Soonwhy metric value must be numeric")
        if isinstance(value, float) and not (-float("inf") < value < float("inf")):
            raise ValueError("Soonwhy metric value must be finite")

        record: Dict[str, Any] = {
            "name": name,
            "value": value,
            "timeUnixNano": str(time.time_ns()),
            "attributes": attributes,
        }
        if unit:
            record["unit"] = unit
        self._metrics.append(record)

    def flush(self) -> Tuple[int, int]:
        logs = self._logs[:]
        metrics = self._metrics[:]
        self._logs.clear()
        self._metrics.clear()

        sent = 0
        dropped = 0

        if logs:
            if self._send("logs", self._logs_payload(logs)):
                sent += len(logs)
            else:
                dropped += len(logs)

        if metrics:
            if self._send("metrics", self._metrics_payload(metrics)):
                sent += len(metrics)
            else:
                dropped += len(metrics)

        return sent, dropped

    def close(self) -> Tuple[int, int]:
        return self.flush()

    def __enter__(self) -> "Soonwhy":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def _send(self, signal: str, payload: Mapping[str, Any]) -> bool:
        request = urllib.request.Request(
            f"{self.options.endpoint}/{signal}",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.options.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        for attempt in range(self.options.max_retries + 1):
            try:
                with urllib.request.urlopen(request, timeout=self.options.timeout) as response:
                    if 200 <= response.status < 300:
                        return True
            except (urllib.error.URLError, urllib.error.HTTPError):
                pass

            if attempt < self.options.max_retries:
                time.sleep(2**attempt)

        return False

    def _resource(self) -> Dict[str, Any]:
        attributes: Dict[str, Any] = dict(self.options.attributes)
        if self.options.service_name:
            attributes["service.name"] = self.options.service_name
        if self.options.service_version:
            attributes["service.version"] = self.options.service_version
        if self.options.deployment_environment:
            attributes["deployment.environment.name"] = self.options.deployment_environment

        return {"attributes": _to_attributes(attributes)}

    def _logs_payload(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "resourceLogs": [
                {
                    "resource": self._resource(),
                    "scopeLogs": [
                        {
                            "scope": {"name": "soonwhy", "version": SDK_VERSION},
                            "logRecords": [
                                {
                                    "timeUnixNano": record["timeUnixNano"],
                                    "severityNumber": _severity_number(record["level"]),
                                    "severityText": str(record["level"]).upper(),
                                    "body": {"stringValue": str(record["message"])},
                                    "attributes": _to_attributes(record.get("attributes")),
                                }
                                for record in records
                            ],
                        }
                    ],
                }
            ]
        }

    def _metrics_payload(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for record in records:
            groups.setdefault(str(record["name"]), []).append(record)

        return {
            "resourceMetrics": [
                {
                    "resource": self._resource(),
                    "scopeMetrics": [
                        {
                            "scope": {"name": "soonwhy", "version": SDK_VERSION},
                            "metrics": [
                                {
                                    "name": name,
                                    "unit": str(items[0].get("unit", "")),
                                    "gauge": {
                                        "dataPoints": [
                                            {
                                                "timeUnixNano": item["timeUnixNano"],
                                                "asDouble": float(item["value"]),
                                                "attributes": _to_attributes(item.get("attributes")),
                                            }
                                            for item in items
                                        ]
                                    },
                                }
                                for name, items in groups.items()
                            ],
                        }
                    ],
                }
            ]
        }

def _severity_number(level: str) -> int:
    return {
        "trace": 1,
        "debug": 5,
        "info": 9,
        "warn": 13,
        "error": 17,
        "fatal": 21,
    }.get(level.lower(), 9)

def _to_attributes(attributes: Optional[Mapping[str, Any]]) -> List[Dict[str, Any]]:
    if not attributes:
        return []
    return [
        {"key": key, "value": _to_any_value(value)}
        for key, value in attributes.items()
    ]

def _to_any_value(value: Any) -> Dict[str, Any]:
    if isinstance(value, str):
        return {"stringValue": value}
    if isinstance(value, bool):
        return {"boolValue": value}
    if isinstance(value, int):
        return {"intValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if value is None:
        return {"stringValue": "null"}
    if isinstance(value, (list, tuple)):
        return {"arrayValue": {"values": [_to_any_value(item) for item in value]}}
    if isinstance(value, Mapping):
        return {
            "kvlistValue": {
                "values": [
                    {"key": key, "value": _to_any_value(item)}
                    for key, item in value.items()
                ]
            }
        }
    return {"stringValue": str(value)}
