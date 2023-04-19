"use strict";

export interface Options {
    autoConnect: boolean;
    rememberConnectedServer: boolean;
    proxyDns: boolean;
    enableNotifications: boolean;
    enableNotificationsOnlyErrors: boolean;
    enableIpv6Lookups: boolean;
    enableDebugInfo: boolean;
    enableExcludeList: boolean;
    excludeList: string[];
    enableQuickConnect: boolean;
}

export default {
    autoConnect: false,
    rememberConnectedServer: false,
    proxyDns: true,
    enableNotifications: true,
    enableIpv6Lookups: false,
    enableNotificationsOnlyErrors: false,
    enableDebugInfo: false,
    enableExcludeList: false,
    excludeList: [],
    enableQuickConnect: false
} as Options;
