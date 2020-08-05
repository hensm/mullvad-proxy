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
        }
    });


// Current proxy details
let proxy: browser.proxy.Proxy | null;
let proxyConnecting = false;

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
 * listener. If client isn't connected via Mullvad, proxy
 * connection is aborted and user is notified.
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
     *
     * TODO: Investigate edge cases
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
        const address = await mullvadApi.fetchIpAddress();
        logger.info(`IP address: ${address}`);

        browser.notifications.create(
                notifConnectionSucceeded(proxy.host));

        browser.browserAction.setIcon({
            path: browser.runtime.getURL("icons/locked.svg")
        });

        proxyConnecting = false;
    } catch (err) {
        logger.error("Proxy request failed!");

        if (proxy) {
            browser.notifications.create(
                    notifConnectionFailed(proxy.host));

            await disableProxy();
        }
    }
}


/**
 * Removes proxy request listener.
 */
function disableProxy (notify = false) {
    proxyConnecting = false;

    if (notify) {
        browser.notifications.create(
                notifConnectionDisconnected(proxy?.host));
    }

    browser.browserAction.setIcon({
        path: browser.runtime.getURL("icons/unlocked.svg")
    });

    if (isChromium) {
        chrome.proxy.onProxyError.removeListener(onProxyError);
        chrome.proxy.settings.clear({
            scope: "regular"
        });
    } else {
        browser.proxy.onError.removeListener(onProxyError);
        browser.proxy.onRequest.removeListener(onProxyRequest);
    }

    proxy = null;
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
                const host = mullvadApi.getFullSocksHost(
                        message.data.proxyHost);

                port.postMessage({
                    subject: "popup:/update"
                  , data: {
                        isConnected: false
                      , isConnecting: true
                    }
                });

                await enableProxy(host, message.data.details);
                break;
            }

            case "background:/disconnect": {
                await disableProxy(true);
                break;
            }
        }

        sendPopupUpdate();
    });

    sendPopupUpdate();
});
