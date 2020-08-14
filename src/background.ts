"use strict";

import logger from "./lib/logger";
import * as utils from "./lib/utils";
import * as mullvadApi from "./lib/mullvadApi";

import messages from "./messages";


const _ = browser.i18n.getMessage;


type CreateNotificationOptions =
        browser.notifications.CreateNotificationOptions;

// If proxy connected successfully
const notifConnectionSucceeded = (host = "host")
        : CreateNotificationOptions => ({
    title: _("notificationConnectionSucceededTitle")
  , message: _("notificationConnectionSucceededMessage", host)
  , type: "basic"
});

// If proxy server is unreachable or misc connection error
const notifConnectionFailed = (host = "host")
        : CreateNotificationOptions => ({
    title: _("notificationConnectionFailedTitle")
  , message: _("notificationConnectionFailedMessage", host)
  , type: "basic"
});

// If user is not connected to a Mullvad VPN server
const notifConnectionFailedNonMullvad: CreateNotificationOptions = {
    title: _("notificationConnectionFailedTitle")
  , message: _("notificationConnectionFailedMessageNonMullvad")
  , type: "basic"
};

// If proxy is manually disconnected
const notifConnectionDisconnected = (host = "host")
        : CreateNotificationOptions => ({
    title: _("notificationConnectionDisconnectedTitle")
  , message: _("notificationConnectionDisconnectedMessage", host)
  , type: "basic"
});


let isChromium: boolean;
const { chrome } = (window as any);

utils.isChromium()
    .then(res => {
        isChromium = res;

        // Ensure Chrome proxy settings are cleared
        if (isChromium) {
            disableProxy();
        } else {
            browser.browserAction.setBadgeBackgroundColor({
                color: "#294d73"
            });
        }
    });


// Current proxy details
let proxy: browser.proxy.Proxy | null;
let proxyConnecting = false;
let proxyAbortController = new AbortController();

function onProxyRequest (_details: browser.proxy._OnRequestDetails) {
    return proxy;
}

function onProxyError (...args: any[]) {
    logger.error("Proxy error!", args);
    browser.notifications.create(
            notifConnectionFailed(proxy?.host));
    disableProxy();
}


/**
 * Checks current connection is valid and sets up proxy request
 * listener (or in Chromium, sets the browser proxy settings).
 * If client isn't connected via Mullvad, proxy connection is
 * aborted and user is notified.
 */
async function enableProxy (
        host: string
      , details: mullvadApi.ConnectionDetails) {

    if (proxyConnecting) {
        return;
    }

    logger.info("Connecting...");


    /**
     * Mullvad SOCKS5 proxy servers do not require authentication,
     * since they're siloed within the network and accessible only
     * to authenticated users already.
     */
    proxy = {
        type: "socks"
      , host: host
      , port: mullvadApi.SOCKS_PORT
    }

    proxyConnecting = true;


    // Quit if not connected to a Mullvad server
    if (!details.mullvad_exit_ip) {
        logger.error("Not connected via Mullvad!");
        browser.notifications.create(notifConnectionFailedNonMullvad);
        await disableProxy();
        return;
    }

    /**
     * Firefox uses a request-based proxy API that allows more
     * granular control over which requests are proxied, whereas
     * Chrome is more limited, only allowing basic, declarative
     * customizations.
     */
    if (isChromium) {
        logger.info("Proxy registered", proxy);

        chrome.proxy.onProxyError.addListener(onProxyError);
        chrome.proxy.settings.set({
            scope: "regular"
          , value: {
                mode: "fixed_servers"
              , rules: {
                    singleProxy: {
                        scheme: "socks5"
                      , host: proxy.host
                      , port: parseInt(proxy.port)
                    }
                }
            }
        });
    } else {
        logger.info("Proxy registered", proxy);

        browser.proxy.onError.addListener(onProxyError);
        browser.proxy.onRequest.addListener(onProxyRequest, {
            urls: [ "<all_urls>" ]
        });
    }


   try {
        // Request to trigger proxy
        const address = await mullvadApi.fetchIpAddress({
            signal: proxyAbortController.signal
        });

        logger.info(`IP address: ${address}`);

        browser.notifications.create(
                notifConnectionSucceeded(proxy.host));

        browser.browserAction.setIcon({
            path: browser.runtime.getURL("icons/locked.svg")
        });

        proxyConnecting = false;
    } catch (err) {
        // Only handle request errors for the current fetch
        if (proxy?.host === host) {
            logger.error("Proxy request failed!");
            browser.notifications.create(
                    notifConnectionFailed(proxy.host));

            await disableProxy();
        }
    }
}


/**
 * Removes proxy request listener, (or in Chromium, clears the
 * browser proxy settings).
 */
async function disableProxy (notify = false) {
    if (notify) {
        browser.notifications.create(
                notifConnectionDisconnected(proxy?.host));
    }

    browser.browserAction.setIcon({
        path: browser.runtime.getURL("icons/unlocked.svg")
    });

    browser.browserAction.setBadgeText({
        text: null
    });

    if (isChromium) {
        await new Promise(resolve => {
            chrome.proxy.onProxyError.removeListener(onProxyError);
            chrome.proxy.settings.clear({
                scope: "regular"
            }, resolve);
        });
    } else {
        browser.proxy.onError.removeListener(onProxyError);
        browser.proxy.onRequest.removeListener(onProxyRequest);
    }

    proxy = null;
    proxyConnecting = false;
    proxyAbortController.abort();
    proxyAbortController = new AbortController();
}



messages.onConnect.addListener(port => {
    function sendPopupUpdate () {
        port.postMessage({
            subject: "popup:/update"
          , data: {
                isConnected: !!proxy && !proxyConnecting
              , isConnecting: proxyConnecting
              , host: proxy?.host
            }
        });
    }

    if (port.name !== "background") {
        return;
    }

    port.onMessage.addListener(async message => {
        switch (message.subject) {
            case "background:/connect": {
                const IP_ADDR_REGEX = /(?:\d{1,3}\.){3}\d{1,3}/;
                const host = IP_ADDR_REGEX.test(message.data.proxyHost)
                    ? message.data.proxyHost
                    : mullvadApi.getFullSocksHost(message.data.proxyHost);

                port.postMessage({
                    subject: "popup:/update"
                  , data: {
                        isConnected: false
                      , isConnecting: true
                    }
                });

                await enableProxy(host, message.data.details);
                sendPopupUpdate();
                break;
            }

            case "background:/disconnect": {
                await disableProxy(true);
                sendPopupUpdate();
                break;
            }

            case "background:/updateConnectionDetails": {
                if (proxy && !proxyConnecting) {
                    browser.browserAction.setBadgeText({
                        text: mullvadApi.COUNTRY_NAME_MAP[
                                message.data.details.country].toUpperCase()
                    });
                }

                break;
            }
        }
    });

    sendPopupUpdate();
});
