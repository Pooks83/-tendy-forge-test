export function contextSwitchOperationKey(pending,profileId,create=()=>crypto.randomUUID()){
 const existing=pending.get(profileId);
 if(existing)return existing;
 const key=create();
 pending.set(profileId,key);
 return key;
}

export function completeContextSwitch(pending,profileId){
 pending.delete(profileId);
}
