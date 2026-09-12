export async function loadInitialAccess(fetcher,readResponse){
 const playerResponse=await fetcher('/api/player',{cache:'no-store'});
 if(playerResponse.ok){
  const player=await readResponse(playerResponse);
  const missionResponse=await fetcher('/api/mission',{cache:'no-store'});
  return {kind:'player',player,mission:await readResponse(missionResponse)};
 }
 if(playerResponse.status===401)return {kind:'guest'};
 if(playerResponse.status===409){
  const adultResponse=await fetcher('/api/training',{cache:'no-store'});
  if(adultResponse.status===401)return {kind:'guest'};
  const data=await readResponse(adultResponse);
  return {kind:'adult',profiles:data.profiles};
 }
 await readResponse(playerResponse);
 throw new Error('Player access could not be loaded.');
}

export function activeAdultProfileId(profiles){
 return profiles.find(profile=>profile.active)?.id||profiles[0]?.id||'';
}

export function buildPlayerViewState(projected,defaults){
 return {...defaults,...projected,checks:[],evaluations:[]};
}
