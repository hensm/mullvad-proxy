// Add accessible proxy types
declare namespace browser.proxy {
    interface Proxy {
        type: string;
        host: string;
        port: string;
        username?: string;
        password?: string;
        proxyDNS?: boolean;
        failoverTimeout?: number;
        proxyAuthorizationHeader?: string;
        connectionIsolationKey?: string;
    }
}
