export async function readTrainingResponse(response) {
 const text=await response.text();
 let data;
 try {data=text?JSON.parse(text):{};} catch {data={};}
 if(!response.ok)throw new Error(data?.error||'Training is temporarily unavailable. Your progress was not changed.');
 return data;
}
