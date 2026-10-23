import {initNode,type NodeSdk,type NodeSdkOptions} from '@soonwhy/node';
export interface NextjsSdkOptions extends NodeSdkOptions{browser?:{apiKey:string;endpoint?:string}}
let serverSdk:NodeSdk|undefined;
export function initNextjs(options:NextjsSdkOptions):NodeSdk{serverSdk??=initNode(options);return serverSdk}
export async function shutdownNextjs():Promise<void>{await serverSdk?.shutdown();serverSdk=undefined}
export function getBrowserConfig(options:NextjsSdkOptions):NextjsSdkOptions['browser']{return options.browser}