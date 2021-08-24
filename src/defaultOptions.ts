"use strict";

import { Options } from "./lib/options";


export default {
    autoConnect: false
  , rememberConnectedServer: false
  , proxyDns: true
  , enableNotifications: true
  , enableIpv6Lookups: false
  , enableNotificationsOnlyErrors: false
  , enableDebugInfo: false
  , enableExcludeList: false
  , excludeList: []
} as Options;
