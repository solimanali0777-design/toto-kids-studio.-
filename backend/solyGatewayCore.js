import { getToolContract, validateToolArgs } from './toolContracts.js';
import { executeWithRecovery } from './selfRepairLoop.mjs';
const idemCache=new Map();
const breaker=new Map();
export class GatewayError extends Error{constructor(code,message,status=400){super(message);this.code=code;this.status=status;}}
function assertScope(contract,scopes=[]){const ok=contract.allowedScopes.every(s=>scopes.includes(s));if(!ok)throw new GatewayError('scope_denied','Tool scope is not allowed',403);}
function needsConfirm(contract,{paid=false,externalWrite=false}={}){return contract.requiresConfirmation===true||(contract.requiresConfirmation==='when_paid'&&paid)||(contract.requiresConfirmation==='when_external_write'&&externalWrite);}
function breakerState(toolId){const b=breaker.get(toolId);if(!b)return null;if(b.until&&Date.now()<b.until)return b;breaker.delete(toolId);return null;}
function recordFailure(toolId){const b=breaker.get(toolId)||{failures:0};b.failures+=1;if(b.failures>=3)b.until=Date.now()+60000;breaker.set(toolId,b);}
function recordSuccess(toolId){breaker.delete(toolId);}
export async function executeToolRequest(request,{scopes=[],confirmed=false,estimatedCostUsd=0,maxCostUsd=Infinity,executors={}}={}){
  const {toolId,args={},idempotencyKey=''}=request||{}; const contract=getToolContract(toolId); if(!contract)throw new GatewayError('tool_not_found','Unknown tool',404);
  assertScope(contract,scopes);
  try{validateToolArgs(contract,args);}catch(error){throw new GatewayError(error.code||'schema_error',error.message,400);}
  if(breakerState(toolId))throw new GatewayError('circuit_open','Tool temporarily paused after repeated failures',503);
  if(Number(estimatedCostUsd)>Number(maxCostUsd))throw new GatewayError('budget_exceeded','Estimated cost exceeds owner budget',402);
  if(needsConfirm(contract,{paid:Number(estimatedCostUsd)>0,externalWrite:contract.requiresConfirmation==='when_external_write'})&&!confirmed)throw new GatewayError('approval_required','Explicit approval required',409);
  if(contract.idempotent&&idempotencyKey&&idemCache.has(idempotencyKey))return idemCache.get(idempotencyKey);
  const exec=executors[toolId]; if(typeof exec!=='function')throw new GatewayError('adapter_unavailable','Tool adapter is not connected',503);
  const started=Date.now();
  const externalWrite=contract.requiresConfirmation==='when_external_write';
  const paid=Number(estimatedCostUsd)>0;
  const runOnce=()=>Promise.race([
    exec(args,{timeoutMs:contract.timeoutMs}),
    new Promise((_,rej)=>setTimeout(()=>rej(new GatewayError('timeout','Tool timed out',504)),contract.timeoutMs)),
  ]);
  try{
    const recovery=await executeWithRecovery(runOnce,{
      maxAttempts:2,
      retryDelayMs:180,
      riskLevel:contract.riskLevel,
      idempotent:Boolean(contract.idempotent),
      externalWrite,
      paid,
    });
    recordSuccess(toolId);
    const envelope={ok:true,toolId,result:recovery.result,audit:{durationMs:Date.now()-started,riskLevel:contract.riskLevel,estimatedCostUsd:Number(estimatedCostUsd||0),recovered:Boolean(recovery.recovered),recoveryRoute:recovery.route,recoveryEvents:recovery.events}};
    if(contract.idempotent&&idempotencyKey)idemCache.set(idempotencyKey,envelope); return envelope;
  }catch(error){
    recordFailure(toolId);
    if(error instanceof GatewayError)throw error;
    const wrapped=new GatewayError(error.code||'adapter_error',String(error?.message||error),Number(error?.status||error?.cause?.status||502));
    wrapped.repair=error?.repair||null;
    throw wrapped;
  }
}
