"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientRegistrationError = exports.OAuth2ClientStore = exports.AuthorizationCodeFlow = exports.createOAuth2Server = exports.supportsUsedResources = exports.freeUsedPort = exports.registerUsedPort = exports.trackUsedPort = exports.ACME_TOKEN_REGEX = exports.ACME_CHALLENGE_STATE_PATTERN = exports.ACME_CHALLENGE_PREFIX = exports.findAcmeChallenge = exports.acmeChallengeToken = exports.acmeChallengeMiddleware = exports.serveAcmeChallenge = exports.WebServer = void 0;
var webServer_1 = require("./lib/webServer");
Object.defineProperty(exports, "WebServer", { enumerable: true, get: function () { return webServer_1.WebServer; } });
var acmeChallenge_1 = require("./lib/acmeChallenge");
Object.defineProperty(exports, "serveAcmeChallenge", { enumerable: true, get: function () { return acmeChallenge_1.serveAcmeChallenge; } });
Object.defineProperty(exports, "acmeChallengeMiddleware", { enumerable: true, get: function () { return acmeChallenge_1.acmeChallengeMiddleware; } });
Object.defineProperty(exports, "acmeChallengeToken", { enumerable: true, get: function () { return acmeChallenge_1.acmeChallengeToken; } });
Object.defineProperty(exports, "findAcmeChallenge", { enumerable: true, get: function () { return acmeChallenge_1.findAcmeChallenge; } });
Object.defineProperty(exports, "ACME_CHALLENGE_PREFIX", { enumerable: true, get: function () { return acmeChallenge_1.ACME_CHALLENGE_PREFIX; } });
Object.defineProperty(exports, "ACME_CHALLENGE_STATE_PATTERN", { enumerable: true, get: function () { return acmeChallenge_1.ACME_CHALLENGE_STATE_PATTERN; } });
Object.defineProperty(exports, "ACME_TOKEN_REGEX", { enumerable: true, get: function () { return acmeChallenge_1.ACME_TOKEN_REGEX; } });
var usedResources_1 = require("./lib/usedResources");
Object.defineProperty(exports, "trackUsedPort", { enumerable: true, get: function () { return usedResources_1.trackUsedPort; } });
Object.defineProperty(exports, "registerUsedPort", { enumerable: true, get: function () { return usedResources_1.registerUsedPort; } });
Object.defineProperty(exports, "freeUsedPort", { enumerable: true, get: function () { return usedResources_1.freeUsedPort; } });
Object.defineProperty(exports, "supportsUsedResources", { enumerable: true, get: function () { return usedResources_1.supportsUsedResources; } });
__exportStar(require("./lib/certificateManager"), exports);
__exportStar(require("./lib/securityChecker"), exports);
var oauth2_1 = require("./lib/oauth2");
Object.defineProperty(exports, "createOAuth2Server", { enumerable: true, get: function () { return oauth2_1.createOAuth2Server; } });
var oauth2_authcode_1 = require("./lib/oauth2-authcode");
Object.defineProperty(exports, "AuthorizationCodeFlow", { enumerable: true, get: function () { return oauth2_authcode_1.AuthorizationCodeFlow; } });
var oauth2_clients_1 = require("./lib/oauth2-clients");
Object.defineProperty(exports, "OAuth2ClientStore", { enumerable: true, get: function () { return oauth2_clients_1.OAuth2ClientStore; } });
Object.defineProperty(exports, "ClientRegistrationError", { enumerable: true, get: function () { return oauth2_clients_1.ClientRegistrationError; } });
//# sourceMappingURL=index.js.map