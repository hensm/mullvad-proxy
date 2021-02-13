"use strict";

import React from "react";
import ReactDOM from "react-dom";

import { OptionsView } from "./OptionsView";

import * as utils from "../../lib/utils";


utils.getBrowserType().then(type => {
    console.log(type);
    if (type === utils.BrowserType.Firefox) {
        const linkElement = document.createElement("link");
        linkElement.rel = "stylesheet";
        linkElement.href = "options-firefox.css";

        document.head.append(linkElement);
    }
})


ReactDOM.render(<OptionsView />, document.body);
