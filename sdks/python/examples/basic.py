import os
from soonwhy import Soonwhy, SoonwhyOptions

with Soonwhy(SoonwhyOptions(
    api_key=os.environ['SOONWHY_API_KEY'],
    service_name='example-python-service',
)) as sdk:
    sdk.capture_log('Python SDK example started')
    sdk.capture_metric('example.requests', 1)
    print({'sent': sdk.flush()[0]})
