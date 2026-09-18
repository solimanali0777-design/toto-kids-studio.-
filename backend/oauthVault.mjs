import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { durableConfigured, durableGet, durablePut } from './durableStore.mjs';

const VAULT_FILE=process.env.SOLY_TOKEN_VAULT_PATH||'/tmp/soly-token-vault.enc.json';
const keyMaterial=()=>String(process.env.SOLY_TOKEN_VAULT_KEY||'').trim();
const key=()=>createHash('sha256').update(keyMaterial()).digest();

export function tokenVaultStatus(){return {configured:Boolean(keyMaterial()),driver:durableConfigured()?'encrypted-supabase':'encrypted-file',path:durableConfigured()?'supabase:oauth-vault':VAULT_FILE,persistentHint:durableConfigured()||!VAULT_FILE.startsWith('/tmp/')};}

async function readRaw(){
  if(!keyMaterial())return {version:1,tokens:{}};
  try{
    const wrapper=durableConfigured()?await durableGet('oauth-vault','tokens'):JSON.parse(await readFile(VAULT_FILE,'utf8')); if(!wrapper)return {version:1,tokens:{}};
    const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(wrapper.iv,'base64url'));
    decipher.setAuthTag(Buffer.from(wrapper.tag,'base64url'));
    const plain=Buffer.concat([decipher.update(Buffer.from(wrapper.ciphertext,'base64url')),decipher.final()]).toString('utf8');
    const parsed=JSON.parse(plain);
    return parsed&&parsed.tokens?parsed:{version:1,tokens:{}};
  }catch{return {version:1,tokens:{}};}
}

async function writeRaw(data){
  if(!keyMaterial())throw Object.assign(new Error('SOLY_TOKEN_VAULT_KEY is not configured'),{code:'vault_not_configured',status:503});
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key(),iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
  const wrapper={version:1,alg:'AES-256-GCM',iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),ciphertext:encrypted.toString('base64url')};
  if(durableConfigured()){await durablePut('oauth-vault','tokens',wrapper);return;}
  await mkdir(dirname(VAULT_FILE),{recursive:true});
  await writeFile(VAULT_FILE,JSON.stringify(wrapper));
}

export async function getVaultRecord(id){const data=await readRaw();return data.tokens?.[id]||null;}
export async function putVaultRecord(id,value){const data=await readRaw();data.tokens={...(data.tokens||{}),[id]:{...value,updatedAt:new Date().toISOString()}};await writeRaw(data);return {id,updatedAt:data.tokens[id].updatedAt};}
export async function deleteVaultRecord(id){const data=await readRaw();if(data.tokens)delete data.tokens[id];await writeRaw(data);return {id,deleted:true};}
export async function listVaultRecords(){const data=await readRaw();return Object.entries(data.tokens||{}).map(([id,row])=>({id,updatedAt:row.updatedAt||null,scope:row.scope||null,provider:row.provider||id}));}
