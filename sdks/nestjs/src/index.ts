import {Global,Module,OnApplicationShutdown} from '@nestjs/common';
import {initNode,type NodeSdk,type NodeSdkOptions} from '@soonwhy/node';
export type NestjsSdkOptions=NodeSdkOptions;
@Global()
@Module({})
export class SoonwhyModule implements OnApplicationShutdown{
 private static sdk:NodeSdk|undefined;
 static forRoot(options:NestjsSdkOptions):typeof SoonwhyModule{SoonwhyModule.sdk=initNode({...options,instrumentations:{...options.instrumentations,nestjs:true,http:true,express:true}});return SoonwhyModule}
 static getClient():NodeSdk{if(!SoonwhyModule.sdk)throw new Error('SoonwhyModule.forRoot() has not been called');return SoonwhyModule.sdk}
 async onApplicationShutdown():Promise<void>{await SoonwhyModule.sdk?.shutdown()}
}