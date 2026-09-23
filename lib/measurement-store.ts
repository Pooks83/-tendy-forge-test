import type {AdultIdentity} from './account-identity';
import {getActivePlayer} from './household-store';
import {canonicalError} from './identity-contract.mjs';
import {compareMeasurements,evaluateMeasurement} from './measurement.mjs';

const protocols={
 'tracking-wall-ball-v1':{id:'tracking-wall-ball-v1',attributeId:'TRACKING',metric:'successful_catches',direction:'HIGHER_IS_BETTER',minimumValid:0,maximumValid:100},
} as const;

type Row={id:string;protocol_id:string;attribute_id:string;metric:string;kind:string;value:number;valid:number;recorded_at:string};
const shape=(row:Row)=>({id:row.id,protocolId:row.protocol_id,attributeId:row.attribute_id,metric:row.metric,kind:row.kind,value:row.value,valid:Boolean(row.valid),recordedAt:row.recorded_at});

async function profile(db:D1Database,identity:AdultIdentity){const p=await getActivePlayer(db,identity) as unknown as {profile:{id:string}};return p.profile.id;}
async function rows(db:D1Database,profileId:string){return (await db.prepare('SELECT id,protocol_id,attribute_id,metric,kind,value,valid,recorded_at FROM training_measurements WHERE profile_id=? ORDER BY recorded_at,id').bind(profileId).all<Row>()).results;}

function latestComparison(values:ReturnType<typeof shape>[]){
 const retest=[...values].reverse().find(x=>x.kind==='RETEST'&&x.valid);if(!retest)return null;
 const baseline=[...values].reverse().find(x=>x.kind==='BASELINE'&&x.valid&&x.protocolId===retest.protocolId&&x.recordedAt<=retest.recordedAt);if(!baseline)return null;
 const protocol=protocols[retest.protocolId as keyof typeof protocols];return compareMeasurements({baseline,retest,direction:protocol.direction});
}
export async function getMeasurements(db:D1Database,identity:AdultIdentity){const profileId=await profile(db,identity);const measurements=(await rows(db,profileId)).map(shape);return {profileContextId:profileId,measurements,latestComparison:latestComparison(measurements)};}
export async function recordMeasurement(db:D1Database,identity:AdultIdentity,input:{protocolId:string;kind:string;value:number},operationKey:string,now=new Date()){
 const profileId=await profile(db,identity);const protocol=protocols[input.protocolId as keyof typeof protocols];if(!protocol)throw canonicalError('MEASUREMENT_PROTOCOL_INVALID','This measurement is not available.',400);
 const measured=evaluateMeasurement({protocol,value:input.value,kind:input.kind});if(!measured.valid)throw canonicalError('MEASUREMENT_INVALID','Check the result and try again.',400);
 const existing=await db.prepare('SELECT id,protocol_id,attribute_id,metric,kind,value,valid,recorded_at FROM training_measurements WHERE profile_id=? AND source_operation_key=?').bind(profileId,operationKey).first<Row>();if(existing){const measurement=shape(existing);const values=(await rows(db,profileId)).map(shape);return {measurement,comparison:measurement.kind==='RETEST'?latestComparison(values):null,replayed:true};}
 const recordedAt=now.toISOString(),id=`measure:${profileId}:${operationKey}`;
 await db.prepare('INSERT INTO training_measurements(id,profile_id,protocol_id,attribute_id,metric,kind,value,valid,recorded_at,source_operation_key) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,profileId,measured.protocolId,measured.attributeId,measured.metric,measured.kind,measured.value,1,recordedAt,operationKey).run();
 const measurement={id,...measured,recordedAt};const values=(await rows(db,profileId)).map(shape);return {measurement,comparison:measured.kind==='RETEST'?latestComparison(values):null,replayed:false};
}
