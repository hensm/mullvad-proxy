"use strict";

export enum BrowserType {
    Chromium,
    Firefox,
    Unknown
}

export async function getBrowserType() {
    // Workaround types
    type GetBrowserInfo = () => Promise<browser.runtime.BrowserInfo>;
    const getBrowserInfo: GetBrowserInfo | undefined = browser.runtime
        .getBrowserInfo as any;

    if (getBrowserInfo) {
        const browserInfo = await getBrowserInfo();

        switch (browserInfo.name.toLowerCase()) {
            case "firefox":
                return BrowserType.Firefox;
            default:
                return BrowserType.Unknown;
        }
    }

    return BrowserType.Chromium;
}

export function getMinutesInMs(minutes: number) {
    return minutes * 60 * 1000;
}
