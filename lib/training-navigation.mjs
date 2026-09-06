const views=new Map([['home','Home'],['train','Train'],['progress','Progress'],['profile','Profile']]);

export function parseTrainingLocation(search,validDrills=[]) {
 const params=new URLSearchParams(search);
 const view=views.get((params.get('view')||'home').toLowerCase())||'Home';
 const requested=params.get('drill');
 const drill=requested&&validDrills.includes(requested)?requested:null;
 return {view,drill};
}

export function trainingLocation({view,drill}) {
 const params=new URLSearchParams();
 if(view&&view!=='Home')params.set('view',view.toLowerCase());
 if(drill)params.set('drill',drill);
 const query=params.toString();
 return query?`/?${query}`:'/';
}

export function resolveTrainingDrill(enabled,selected,validDrills=[]) {
 return enabled&&selected&&validDrills.includes(selected)?selected:null;
}
