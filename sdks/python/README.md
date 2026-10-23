# Soonwhy Python SDK

Dependency-free telemetry client for Python applications.

```python
from soonwhy import Soonwhy, SoonwhyOptions
sdk=Soonwhy(SoonwhyOptions(api_key="sw_...",service_name="payments-api"))
sdk.capture_log("payment started",order_id="123")
sdk.capture_metric("payment.duration",42,unit="ms")
sdk.flush()
```