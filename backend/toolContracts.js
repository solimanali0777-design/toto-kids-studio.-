export const TOOL_CONTRACTS={

  'workspace.asset.read':{version:'1.1.0',riskLevel:'L1',allowedScopes:['project:workspace:read'],requiresConfirmation:false,idempotent:true,timeoutMs:20000,allowedTargets:['workspace-storage'],allowedArgs:['workspaceId','projectId','assetId','versionId','includeContent']},
  'workspace.asset.persist':{version:'1.1.0',riskLevel:'L2',allowedScopes:['project:workspace:write'],requiresConfirmation:'when_external_write',idempotent:true,timeoutMs:60000,allowedTargets:['workspace-storage'],allowedArgs:['workspaceId','projectId','assetId','contentType','contentBase64','checksum','classification','metadata']},
  'workspace.project.version.create':{version:'1.0.0',riskLevel:'L2',allowedScopes:['project:workspace:write'],requiresConfirmation:'when_external_write',idempotent:true,timeoutMs:30000,allowedTargets:['workspace-storage'],allowedArgs:['workspaceId','projectId','label','manifestChecksum']},
  'workspace.project.restore':{version:'1.0.0',riskLevel:'L3',allowedScopes:['project:workspace:restore'],requiresConfirmation:true,idempotent:true,timeoutMs:60000,allowedTargets:['workspace-storage'],allowedArgs:['workspaceId','projectId','versionId']},


  'vision.qa.execute':{version:'1.0.0',riskLevel:'L2',allowedScopes:['project:vision:qa'],requiresConfirmation:'when_paid',idempotent:true,timeoutMs:90000,allowedTargets:['generativelanguage.googleapis.com'],allowedArgs:['workspaceId','projectId','assetId','versionId','characterIds']},
  'render.composer.execute':{version:'1.0.0',riskLevel:'L2',allowedScopes:['project:render:execute'],requiresConfirmation:false,idempotent:true,timeoutMs:180000,allowedTargets:['local-render-worker'],allowedArgs:['workspaceId','projectId','timeline','outputName','fps','width','height']},
  'lipsync.plan.generate':{version:'1.0.0',riskLevel:'L1',allowedScopes:['project:lipsync:plan'],requiresConfirmation:false,idempotent:true,timeoutMs:10000,allowedTargets:['internal'],allowedArgs:['transcript','durationMs','wordTimings','language']},

  'gmail.task.search':{version:'1.0.0',riskLevel:'L1',allowedScopes:['account:gmail:read-task'],requiresConfirmation:false,idempotent:true,timeoutMs:20000,allowedTargets:['gmail.googleapis.com'],allowedArgs:['q','limit']},
  'gmail.verification.locate':{version:'1.0.0',riskLevel:'L2',allowedScopes:['account:gmail:verify'],requiresConfirmation:false,idempotent:true,timeoutMs:15000,allowedTargets:['gmail.googleapis.com'],allowedArgs:['q','limit']},
  'google.drive.project.list':{version:'1.0.0',riskLevel:'L1',allowedScopes:['project:google-drive:read'],requiresConfirmation:false,idempotent:true,timeoutMs:20000,allowedTargets:['www.googleapis.com'],allowedArgs:['q','limit']},
  'm365.mail.search':{version:'1.0.0',riskLevel:'L1',allowedScopes:['account:m365:mail-read'],requiresConfirmation:false,idempotent:true,timeoutMs:20000,allowedTargets:['graph.microsoft.com'],allowedArgs:['q','limit']},
  'm365.drive.list':{version:'1.0.0',riskLevel:'L1',allowedScopes:['project:m365:files-read'],requiresConfirmation:false,idempotent:true,timeoutMs:20000,allowedTargets:['graph.microsoft.com'],allowedArgs:['path']},
  'browser.session.task':{version:'1.0.0',riskLevel:'L2',allowedScopes:['account:web:task'],requiresConfirmation:false,idempotent:true,timeoutMs:120000,allowedTargets:['delegated-browser-broker'],allowedArgs:['taskId','url','goal','sessionRef','allowSignup','allowStandardFreeTerms','containsPayment','containsCard','accessPersonalMedia','phoneOrMessaging']},
  'googleplay.track.read':{version:'1.0.0',riskLevel:'L1',allowedScopes:['google-play:read'],requiresConfirmation:false,idempotent:true,timeoutMs:30000,allowedTargets:['androidpublisher.googleapis.com'],allowedArgs:['packageName','track']},
  'googleplay.draft.release':{version:'1.0.0',riskLevel:'L2',allowedScopes:['google-play:internal-write'],requiresConfirmation:false,idempotent:true,timeoutMs:60000,allowedTargets:['androidpublisher.googleapis.com'],allowedArgs:['packageName','track','versionCodes','name','releaseNotes']},
  'googleplay.production.publish':{version:'1.0.0',riskLevel:'L3',allowedScopes:['google-play:production-publish'],requiresConfirmation:true,idempotent:true,timeoutMs:60000,allowedTargets:['androidpublisher.googleapis.com'],allowedArgs:['packageName','track','versionCodes','name','releaseNotes']},
  'opportunity.official.scan':{version:'1.0.0',riskLevel:'L1',allowedScopes:['project:opportunities:read'],requiresConfirmation:'when_paid',idempotent:true,timeoutMs:90000,allowedTargets:['generativelanguage.googleapis.com'],allowedArgs:['query']},
  'youtube.public.search':{version:'1.1.0',riskLevel:'L0',allowedScopes:['project:trends:read'],requiresConfirmation:false,idempotent:true,timeoutMs:12000,allowedTargets:['www.googleapis.com'],allowedArgs:['q','country','limit','publishedAfter']},
  'youtube.analytics.read':{version:'1.1.0',riskLevel:'L1',allowedScopes:['project:analytics:read'],requiresConfirmation:false,idempotent:true,timeoutMs:15000,allowedTargets:['youtubeanalytics.googleapis.com'],allowedArgs:['startDate','endDate','metrics','dimensions','filters','sort','maxResults']},
  'youtube.channel.read':{version:'1.0.0',riskLevel:'L1',allowedScopes:['project:analytics:read'],requiresConfirmation:false,idempotent:true,timeoutMs:15000,allowedTargets:['www.googleapis.com'],allowedArgs:[]},
  'google.analytics.read':{version:'1.0.0',riskLevel:'L1',allowedScopes:['project:analytics:read'],requiresConfirmation:false,idempotent:true,timeoutMs:15000,allowedTargets:['analyticsdata.googleapis.com'],allowedArgs:['propertyId','startDate','endDate','metrics','dimensions','limit']},
  'openai.brain.execute':{version:'1.1.0',riskLevel:'L2',allowedScopes:['project:ai:execute'],requiresConfirmation:'when_paid',idempotent:true,timeoutMs:90000,allowedTargets:['api.openai.com'],allowedArgs:['model','input','instructions','maxOutputTokens']},
  'google.ai.execute':{version:'1.1.0',riskLevel:'L2',allowedScopes:['project:ai:execute'],requiresConfirmation:'when_paid',idempotent:true,timeoutMs:120000,allowedTargets:['generativelanguage.googleapis.com'],allowedArgs:['model','prompt','systemInstruction']},
  'canva.design.execute':{version:'1.1.0',riskLevel:'L2',allowedScopes:['project:design:write'],requiresConfirmation:'when_external_write',idempotent:true,timeoutMs:60000,allowedTargets:['api.canva.com'],allowedArgs:['action','payload']},
  'soly.council.review':{version:'1.0.0',riskLevel:'L1',allowedScopes:['project:ai:review'],requiresConfirmation:false,idempotent:true,timeoutMs:120000,allowedTargets:['internal','api.openai.com','generativelanguage.googleapis.com','api.anthropic.com'],allowedArgs:['goal','diagnosis','constraints','architecture','maxMembers']},
  'repo.file.read':{version:'1.0.0',riskLevel:'L1',allowedScopes:['project:code:read'],requiresConfirmation:false,idempotent:true,timeoutMs:15000,allowedTargets:['api.github.com'],allowedArgs:['path','ref']},
  'repo.branch.create':{version:'1.0.0',riskLevel:'L2',allowedScopes:['project:code:write'],requiresConfirmation:'when_external_write',idempotent:true,timeoutMs:15000,allowedTargets:['api.github.com'],allowedArgs:['branch','fromRef']},
  'repo.patch.apply':{version:'1.0.0',riskLevel:'L2',allowedScopes:['project:code:write'],requiresConfirmation:'when_external_write',idempotent:true,timeoutMs:20000,allowedTargets:['api.github.com'],allowedArgs:['path','branch','content','sha','message']},
  'repo.rollback':{version:'1.0.0',riskLevel:'L2',allowedScopes:['project:code:write'],requiresConfirmation:'when_external_write',idempotent:true,timeoutMs:20000,allowedTargets:['api.github.com'],allowedArgs:['branch','targetSha']},
  'toto.export.clean':{version:'1.1.0',riskLevel:'L1',allowedScopes:['project:export:check'],requiresConfirmation:false,idempotent:true,timeoutMs:5000,allowedTargets:['internal'],allowedArgs:['assets','policy','safety','manifestValidation','syncAudit']},
};
export function getToolContract(toolId){ return TOOL_CONTRACTS[toolId]||null; }
export function validateToolArgs(contract,args={}){
  if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('invalid_args');
  const allowed=new Set(contract.allowedArgs||[]); const unknown=Object.keys(args).filter(k=>!allowed.has(k));
  if(unknown.length)throw Object.assign(new Error(`Unknown arguments: ${unknown.join(', ')}`),{code:'schema_error'});
  return true;
}
