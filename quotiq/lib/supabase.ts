import { createClient, type Session } from '@supabase/supabase-js';
import type { Business,Customer,Estimate,Invoice,Project,InventoryItem,Expense,TeamMember } from '../types';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;const anonKey=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
export const cloudConfigured=Boolean(url&&anonKey);export const supabase=cloudConfigured?createClient(url!,anonKey!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export type WorkspaceSnapshot={business:Business;customers:Customer[];estimates:Estimate[];invoices:Invoice[];projects:Project[];inventory:InventoryItem[];expenses:Expense[];team:TeamMember[];updated_at?:string};
export async function getSession():Promise<Session|null>{if(!supabase)return null;const{data,error}=await supabase.auth.getSession();if(error)throw error;return data.session}
export async function signIn(email:string,password:string){if(!supabase)throw new Error('Supabase is not configured.');const{error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error}
export async function signUp(email:string,password:string){if(!supabase)throw new Error('Supabase is not configured.');const{error}=await supabase.auth.signUp({email,password});if(error)throw error}
export async function signOut(){if(!supabase)return;const{error}=await supabase.auth.signOut();if(error)throw error}
export async function loadWorkspace(userId:string):Promise<WorkspaceSnapshot|null>{if(!supabase)return null;const{data,error}=await supabase.from('workspace_snapshots').select('business,customers,estimates,invoices,projects,inventory,expenses,team,updated_at').eq('user_id',userId).maybeSingle();if(error)throw error;return data as WorkspaceSnapshot|null}
export async function saveWorkspace(userId:string,snapshot:WorkspaceSnapshot){if(!supabase)return;const{error}=await supabase.from('workspace_snapshots').upsert({user_id:userId,...snapshot,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error}
