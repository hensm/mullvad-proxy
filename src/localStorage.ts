"use strict";

import { TypedStorageArea } from "./lib/TypedStorageArea";

import * as mullvadApi from "./lib/mullvadApi";


export default new TypedStorageArea<{
    serverList: mullvadApi.Server[];
    serverListFrom: number;
    recentServers: mullvadApi.Server[];
}>(browser.storage.local);
