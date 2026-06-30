import { initFirebase } from './infrastructure/firebase/initFirebase';

initFirebase();

export { callAIProxy } from './infrastructure/handlers/callAIProxy';
export { getUserInfo } from './infrastructure/handlers/getUserInfo';
export { checkNicknameAvailability } from './infrastructure/handlers/checkNicknameAvailability';
export { claimNickname } from './infrastructure/handlers/claimNickname';
export { exchangeGmailCode } from './infrastructure/handlers/exchangeGmailCode';
export { gmailPush } from './infrastructure/handlers/gmailPush';
export { renewGmailWatches } from './infrastructure/handlers/renewGmailWatches';
