const adultViews=new Map([['home','Home'],['train','Train'],['progress','Progress'],['profile','Profile']]);
const playerViews=new Map([['today','Today'],['home','Today'],['journey','Journey'],['train','Journey'],['progress','Progress'],['profile','Profile']]);
export const PLAYER_DESTINATIONS=['Today','Journey','Progress','Profile'];

export function parseTrainingLocation(search,validDrills=[],audience='adult') {
 const params=new URLSearchParams(search);
 const player=audience==='player';
 const views=player?playerViews:adultViews;
 const view=views.get((params.get('view')||(player?'today':'home')).toLowerCase())||(player?'Today':'Home');
 const requested=params.get('drill');
 const drill=requested&&validDrills.includes(requested)?requested:null;
 return {view,drill};
}

export function trainingLocation({view,drill}) {
 const params=new URLSearchParams();
 if(view&&view!=='Home'&&view!=='Today')params.set('view',view.toLowerCase());
 if(drill)params.set('drill',drill);
 const query=params.toString();
 return query?`/?${query}`:'/';
}

export function resolveTrainingDrill(enabled,selected,validDrills=[]) {
 return enabled&&selected&&validDrills.includes(selected)?selected:null;
}
