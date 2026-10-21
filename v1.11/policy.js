delete window.VDHSit;
delete window.VDHPolicy;
(window.__vdhOrder = window.__vdhOrder || []).push("policy.js");
(window.__vdhSrc = window.__vdhSrc || {})["policy.js"] = function () {
(function (root) {
  'use strict';
  const freeze = o => { Object.keys(o).forEach(k => { if (o[k] && typeof o[k] === 'object') freeze(o[k]); }); return Object.freeze(o); };
  const VDHPolicy = freeze({ version: 'v1.11', facts: {
   "notWords": "offlinetest|dryrun|rehearsal|notjoe",
   "noteOpeners": [
    "(",
    "["
   ],
   "firstDate": "2020-01-01",
   "liveIds": {
    "flows": [
     310308
    ],
    "segments": [
     1257090,
     1257089,
     1057634,
     1057637,
     1059368,
     1057638
    ],
    "emails": [
     373125,
     488125
    ]
   },
   "switchOver": {
    "segment": "abandoners_active_24h",
    "segmentId": 1059368,
    "segmentName": "Abandoners (active last 24h)",
    "flowId": 310308,
    "flowName": "Abandoned Cart Email Sending Sequence"
   },
   "offStatuses": [
    "deactivated",
    "deactivated-user"
   ],
   "protectedTag": "^(product_|refunded_)|^abandoned_active$",
   "routerFields": [
    "mostrecent_abandoned_at",
    "mostrecent_abandonedproduct_id",
    "mostrecent_abandonedproduct_name",
    "first_channel",
    "first_touch_id",
    "first_hack",
    "first_purchase_at",
    "last_purchase_at",
    "requested_template_name",
    "requested_template_url",
    "LastLoginDate",
    "LoginCount"
   ],
   "builderOps": [
    "/added-tag",
    "/entered-segment",
    "/event",
    "/delay-v2",
    "/send",
    "/add-tag",
    "/remove-tag",
    "/check-field",
    "/end-flow-v2",
    "/change-field",
    "/archive",
    "/send-webhook"
   ],
   "needsPermissionOps": [
    "/archive",
    "/send-webhook"
   ]
  } });
  if (typeof module !== 'undefined' && module.exports) module.exports = VDHPolicy;
  else root.VDHPolicy = VDHPolicy;
})(typeof window !== 'undefined' ? window : globalThis);

};
window.__vdhSrc["policy.js"]();
"installed policy.js: " + typeof window.VDHPolicy
