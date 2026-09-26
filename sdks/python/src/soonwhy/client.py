from __future__ import annotations
import json,time,urllib.error,urllib.request
from dataclasses import dataclass,field
from typing import Any,Mapping
@dataclass
class SoonwhyOptions:
    api_key:str
    endpoint:str="http://localhost:3002/v1"
    service_name:str|None=None
    service_version:str|None=None
    deployment_environment:str|None=None
    attributes:Mapping[str,Any]=field(default_factory=dict)
    max_retries:int=3
    timeout:float=10.0
class Soonwhy:
    def __init__(self,options:SoonwhyOptions):
        if not options.api_key.strip(): raise ValueError("Soonwhy api_key is required")
        self.options=options; self._logs=[]; self._metrics=[]
    def capture_log(self,message:str,level:str="info",**attributes:Any)->None:
        self._logs.append({"level":level,"message":message,"timestamp":time.time()*1000,"attributes":attributes})
    def capture_error(self,error:BaseException,**attributes:Any)->None:
        self.capture_log(str(error),level="error",error_type=type(error).__name__,**attributes)
    def capture_metric(self,name:str,value:float,unit:str|None=None,**attributes:Any)->None:
        record={"name":name,"value":value,"timestamp":time.time()*1000,"attributes":attributes}
        if unit: record["unit"]=unit
        self._metrics.append(record)
    def flush(self)->tuple[int,int]:
        sent=dropped=0
        for signal,records in (("logs",self._logs),("metrics",self._metrics)):
            if not records: continue
            payload={"resource":{"serviceName":self.options.service_name,"serviceVersion":self.options.service_version,"deploymentEnvironment":self.options.deployment_environment,"attributes":dict(self.options.attributes)},"records":records}
            if self._send(signal,payload): sent+=len(records)
            else: dropped+=len(records)
            records.clear()
        return sent,dropped
    def close(self)->tuple[int,int]: return self.flush()
    def __enter__(self)->"Soonwhy": return self
    def __exit__(self,*_:object)->None: self.close()
    def _send(self,signal:str,payload:Mapping[str,Any])->bool:
        request=urllib.request.Request(f"{self.options.endpoint.rstrip('/')}/{signal}",data=json.dumps(payload).encode(),headers={"Authorization":f"Bearer {self.options.api_key}","Content-Type":"application/json"},method="POST")
        for attempt in range(self.options.max_retries+1):
            try:
                with urllib.request.urlopen(request,timeout=self.options.timeout) as response:
                    if 200<=response.status<300: return True
            except (urllib.error.URLError,urllib.error.HTTPError): pass
            if attempt<self.options.max_retries: time.sleep(2**attempt)
        return False