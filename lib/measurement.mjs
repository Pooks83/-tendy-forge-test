const allowedKinds=new Set(['BASELINE','RETEST']);
const allowedDirections=new Set(['HIGHER_IS_BETTER','LOWER_IS_BETTER']);

const round1=value=>Math.round(value*10)/10;

export function evaluateMeasurement({protocol,value,kind}){
 const normalizedKind=String(kind||'').toUpperCase();
 const validProtocol=protocol&&typeof protocol.id==='string'&&protocol.id&&typeof protocol.attributeId==='string'&&protocol.attributeId&&typeof protocol.metric==='string'&&protocol.metric&&allowedDirections.has(protocol.direction);
 const numeric=typeof value==='number'&&Number.isFinite(value);
 const inRange=numeric&&value>=protocol?.minimumValid&&value<=protocol?.maximumValid;
 return {
  protocolId:protocol?.id||'',attributeId:protocol?.attributeId||'',metric:protocol?.metric||'',kind:normalizedKind,
  value:numeric?value:null,valid:Boolean(validProtocol&&allowedKinds.has(normalizedKind)&&inRange),
 };
}

export function compareMeasurements({baseline,retest,direction}){
 if(!baseline?.valid||!retest?.valid)return {eligible:false,reason:'INVALID_MEASUREMENT'};
 if(baseline.kind!=='BASELINE'||retest.kind!=='RETEST')return {eligible:false,reason:'MEASUREMENT_KIND_MISMATCH'};
 if(baseline.protocolId!==retest.protocolId||baseline.attributeId!==retest.attributeId||baseline.metric!==retest.metric)return {eligible:false,reason:'PROTOCOL_MISMATCH'};
 if(!allowedDirections.has(direction))return {eligible:false,reason:'DIRECTION_REQUIRED'};
 if(baseline.value===0)return {eligible:false,reason:'ZERO_BASELINE'};
 const absoluteChange=retest.value-baseline.value;
 const percentChange=round1((absoluteChange/Math.abs(baseline.value))*100);
 const improved=direction==='HIGHER_IS_BETTER'?absoluteChange>0:absoluteChange<0;
 return {eligible:true,absoluteChange,percentChange,improved};
}
