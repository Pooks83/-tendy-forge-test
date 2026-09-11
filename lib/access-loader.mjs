export async function loadInitialAccess(fetcher,readResponse){
 const playerResponse=await fetcher('/api/player',{cache:'no-store'});
 if(playerResponse.ok)return {kind:'player',player:await readResponse(playerResponse)};
 if(playerResponse.status===401)return {kind:'guest'};
 if(playerResponse.status===403||playerResponse.status===409){
  const adultResponse=await fetcher('/api/training',{cache:'no-store'});
  if(adultResponse.status===401)return {kind:'guest'};
  const data=await readResponse(adultResponse);
  return {kind:'adult',profiles:data.profiles};
 }
 await readResponse(playerResponse);
 throw new Error('Player access could not be loaded.');
}

export function buildPlayerViewState(projected,defaults){
 return {...defaults,...projected,checks:[],evaluations:[]};
}
