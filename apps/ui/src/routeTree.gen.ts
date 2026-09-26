/* eslint-disable */
// @ts-nocheck
import { Route as Root } from './routes/__root'
import { Route as Index } from './routes/index'
import { Route as Org } from './routes/$organizationSlug'
import { Route as Login } from './routes/login'
import { Route as Onboarding } from './routes/onboarding'
import { Route as Organizations } from './routes/organizations'
import { Route as Register } from './routes/register'
import { Route as Callback } from './routes/auth/callback'
import { Route as Dashboard } from './routes/$organizationSlug/dashboard'
import { Route as Services } from './routes/$organizationSlug/services'
import { Route as Detections } from './routes/$organizationSlug/detections'
import { Route as Investigations } from './routes/$organizationSlug/investigations'
import { Route as Errors } from './routes/$organizationSlug/errors'
import { Route as Logs } from './routes/$organizationSlug/logs'
import { Route as Traces } from './routes/$organizationSlug/traces'
import { Route as ApiKeys } from './routes/$organizationSlug/api-keys'
import { Route as Settings } from './routes/$organizationSlug/settings'
import { Route as Service } from './routes/$organizationSlug/service.$serviceId'
import { Route as Trace } from './routes/$organizationSlug/trace.$traceId'
import { Route as Investigation } from './routes/$organizationSlug/investigations.$investigationId'
import { Route as Project } from './routes/$organizationSlug/p/$projectSlug/route'
import { Route as ProjectIndex } from './routes/$organizationSlug/p/$projectSlug/index'
import { Route as ProjectServices } from './routes/$organizationSlug/p/$projectSlug/services'
import { Route as ProjectDetections } from './routes/$organizationSlug/p/$projectSlug/detections'
import { Route as ProjectInvestigations } from './routes/$organizationSlug/p/$projectSlug/investigations'
import { Route as ProjectErrors } from './routes/$organizationSlug/p/$projectSlug/errors'
import { Route as ProjectLogs } from './routes/$organizationSlug/p/$projectSlug/logs'
import { Route as ProjectTraces } from './routes/$organizationSlug/p/$projectSlug/traces'
import { Route as ProjectApiKeys } from './routes/$organizationSlug/p/$projectSlug/api-keys'
import { Route as ProjectSettings } from './routes/$organizationSlug/p/$projectSlug/settings'
import { Route as ProjectService } from './routes/$organizationSlug/p/$projectSlug/service.$serviceId'
import { Route as ProjectTrace } from './routes/$organizationSlug/p/$projectSlug/trace.$traceId'
import { Route as ProjectInvestigation } from './routes/$organizationSlug/p/$projectSlug/investigations.$investigationId'

const make=(r:any,id:string,path:string,parent:any)=>r.update({id,path,getParentRoute:()=>parent}as any)
const root=Root
const index=make(Index,'/','/',root),org=make(Org,'/$organizationSlug','/$organizationSlug',root),login=make(Login,'/login','/login',root),onboarding=make(Onboarding,'/onboarding','/onboarding',root),organizations=make(Organizations,'/organizations','/organizations',root),register=make(Register,'/register','/register',root),callback=make(Callback,'/auth/callback','/auth/callback',root)
const dashboard=make(Dashboard,'/dashboard','/dashboard',org),services=make(Services,'/services','/services',org),detections=make(Detections,'/detections','/detections',org),investigations=make(Investigations,'/investigations','/investigations',org),errors=make(Errors,'/errors','/errors',org),logs=make(Logs,'/logs','/logs',org),traces=make(Traces,'/traces','/traces',org),apiKeys=make(ApiKeys,'/api-keys','/api-keys',org),settings=make(Settings,'/settings','/settings',org),service=make(Service,'/service/$serviceId','/service/$serviceId',org),trace=make(Trace,'/trace/$traceId','/trace/$traceId',org),investigation=make(Investigation,'/$investigationId','/$investigationId',investigations)
const project=make(Project,'/p/$projectSlug','/p/$projectSlug',org),pi=make(ProjectIndex,'/','/',project),ps=make(ProjectServices,'/services','/services',project),pd=make(ProjectDetections,'/detections','/detections',project),pin=make(ProjectInvestigations,'/investigations','/investigations',project),pe=make(ProjectErrors,'/errors','/errors',project),pl=make(ProjectLogs,'/logs','/logs',project),pt=make(ProjectTraces,'/traces','/traces',project),pka=make(ProjectApiKeys,'/api-keys','/api-keys',project),pset=make(ProjectSettings,'/settings','/settings',project),pservice=make(ProjectService,'/service/$serviceId','/service/$serviceId',project),ptrace=make(ProjectTrace,'/trace/$traceId','/trace/$traceId',project),pinvestigation=make(ProjectInvestigation,'/$investigationId','/$investigationId',pin)
const orgInv=investigations._addFileChildren({Investigation:investigation}),projInv=pin._addFileChildren({Investigation:pinvestigation})
const proj=project._addFileChildren({Index:pi,Services:ps,Detections:pd,Investigations:projInv,Errors:pe,Logs:pl,Traces:pt,ApiKeys:pka,Settings:pset,Service:pservice,Trace:ptrace})
const orgTree=org._addFileChildren({Dashboard:dashboard,Services:services,Detections:detections,Investigations:orgInv,Errors:errors,Logs:logs,Traces:traces,ApiKeys:apiKeys,Settings:settings,Service:service,Trace:trace,Project:proj})
export interface FileRoutesByFullPath {[key:string]:any}
export interface FileRoutesByTo extends FileRoutesByFullPath{}
export interface FileRoutesById extends FileRoutesByFullPath{__root__:typeof Root}
export interface FileRouteTypes{fileRoutesByFullPath:FileRoutesByFullPath;fullPaths:keyof FileRoutesByFullPath;fileRoutesByTo:FileRoutesByTo;to:keyof FileRoutesByTo;id:keyof FileRoutesById;fileRoutesById:FileRoutesById}
export interface RootRouteChildren{[key:string]:any}
export const routeTree=Root._addFileChildren({Index:index,OrganizationSlug:orgTree,Login:login,Onboarding:onboarding,Organizations:organizations,Register:register,Callback:callback})._addFileTypes<FileRouteTypes>()
