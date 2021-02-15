"use strict";

import * as utils from "../../lib/utils";


utils.getBrowserType().then(type => {
    const linkElement = document.createElement("link");
    linkElement.rel = "stylesheet";

    switch (type) {
        case utils.BrowserType.Firefox:
            linkElement.href = browser.runtime.getURL(
                    "ui/options/options-firefox.css");
            break;
        case utils.BrowserType.Chromium:
            linkElement.href = browser.runtime.getURL(
                    "ui/options/options-chromium.css");
            break;
        
        default:
            return;
    }

    document.head.append(linkElement);
});
