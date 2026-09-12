export class MissionRequestError extends Error{
 constructor(message,{code='MISSION_REQUEST_FAILED',status=0,retryable=false}={}){super(message);this.name='MissionRequestError';this.code=code;this.status=status;this.retryable=retryable;}
}

export async function sendMissionMutation(fetcher,item){
 let response;
 try{response=await fetcher('/api/mission',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':item.operationKey},body:JSON.stringify(item.body)});}catch{throw new MissionRequestError('Saved on this device. We’ll sync when connected.',{code:'NETWORK_RETRYABLE',retryable:true});}
 const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch{}
 if(!response.ok){const canonical=data?.error||{};throw new MissionRequestError(canonical.message||'Your mission was not changed.',{code:canonical.code||'MISSION_REQUEST_FAILED',status:response.status,retryable:response.status>=500});}
 return data;
}
