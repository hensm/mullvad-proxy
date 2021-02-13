"use strict";


export async function isChromium () {
    // Workaround types
    type GetBrowserInfo = () => Promise<browser.runtime.BrowserInfo>;
    const getBrowserInfo: (GetBrowserInfo | undefined) =
            (browser.runtime.getBrowserInfo as any);

    if (getBrowserInfo) {
        const browserInfo = await getBrowserInfo();

        switch (browserInfo.name.toLowerCase()) {
            case "firefox": {
                return false;
            };
        }
    }

    return true;
}


export function getMinutesInMs (minutes: number) {
    return (minutes * 60) * 1000;
}
