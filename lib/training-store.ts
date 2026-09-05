import {env} from 'cloudflare:workers';
export function trainingDb() {
 if(!env.DB) throw new Error('Saved training is not available yet. Please try again later.');
 return env.DB;
}
