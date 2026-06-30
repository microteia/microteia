"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gmailPush = exports.exchangeGmailCode = exports.claimNickname = exports.checkNicknameAvailability = exports.getUserInfo = exports.callAIProxy = void 0;
const initFirebase_1 = require("./infrastructure/firebase/initFirebase");
(0, initFirebase_1.initFirebase)();
var callAIProxy_1 = require("./infrastructure/handlers/callAIProxy");
Object.defineProperty(exports, "callAIProxy", { enumerable: true, get: function () { return callAIProxy_1.callAIProxy; } });
var getUserInfo_1 = require("./infrastructure/handlers/getUserInfo");
Object.defineProperty(exports, "getUserInfo", { enumerable: true, get: function () { return getUserInfo_1.getUserInfo; } });
var checkNicknameAvailability_1 = require("./infrastructure/handlers/checkNicknameAvailability");
Object.defineProperty(exports, "checkNicknameAvailability", { enumerable: true, get: function () { return checkNicknameAvailability_1.checkNicknameAvailability; } });
var claimNickname_1 = require("./infrastructure/handlers/claimNickname");
Object.defineProperty(exports, "claimNickname", { enumerable: true, get: function () { return claimNickname_1.claimNickname; } });
var exchangeGmailCode_1 = require("./infrastructure/handlers/exchangeGmailCode");
Object.defineProperty(exports, "exchangeGmailCode", { enumerable: true, get: function () { return exchangeGmailCode_1.exchangeGmailCode; } });
var gmailPush_1 = require("./infrastructure/handlers/gmailPush");
Object.defineProperty(exports, "gmailPush", { enumerable: true, get: function () { return gmailPush_1.gmailPush; } });
//# sourceMappingURL=index.js.map