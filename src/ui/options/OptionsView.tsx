"use strict";

import React, { useCallback, useEffect, useState } from "react";

import options, { Options } from "../../lib/options";
import * as utils from "../../lib/utils";

import localStorage from "../../localStorage";

const _ = browser.i18n.getMessage;

function getInputValue(input: HTMLInputElement) {
    switch (input.type) {
        case "checkbox":
            return input.checked;
        case "number":
            return parseFloat(input.value);

        default:
            return input.value;
    }
}

export const OptionsView = () => {
    const [optionsValues, setOptionsValues] = useState<Options>();
    const [browserType, setBrowserType] = useState<utils.BrowserType>();

    useEffect(() => {
        options.getAll().then(values => setOptionsValues(values));
        utils.getBrowserType().then(browserType => setBrowserType(browserType));

        // Update options data if changed whilst page is open
        function onOptionsChanged() {
            options.getAll().then(values => setOptionsValues(values));
        }

        options.addEventListener("changed", onOptionsChanged);
        return () => {
            options.removeEventListener("changed", onOptionsChanged);
        };
    }, []);

    const handleClearCache = useCallback(() => {
        localStorage.remove(["serverList", "serverListFrom"]);
    }, []);
    const handleClearRecentServers = useCallback(() => {
        localStorage.remove(["recentServers"]);
    }, []);

    const handleInputChange = useCallback(
        (ev: React.ChangeEvent<HTMLInputElement>) => {
            if (optionsValues) {
                const newOptionsValues = { ...optionsValues };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (newOptionsValues as any)[ev.target.name] = getInputValue(
                    ev.target
                );
                options.setAll(newOptionsValues);
            }
        },
        [optionsValues]
    );

    const handleExcludeListChange = useCallback(
        (ev: React.ChangeEvent<HTMLTextAreaElement>) => {
            if (optionsValues) {
                const newOptionsValues = { ...optionsValues };
                if (ev.target.value === "") {
                    newOptionsValues.excludeList = [];
                }
                newOptionsValues.excludeList = ev.target.value.split("\n");
                options.setAll(newOptionsValues);
            }
        },
        [optionsValues]
    );

    return (
        <form className="options">
            {optionsValues && (
                <>
                    <label className="option option--inline">
                        <div className="option__control">
                            <input
                                name="autoConnect"
                                type="checkbox"
                                checked={optionsValues?.autoConnect}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="option__label">
                            {_("optionsAutoConnectLabel")}
                        </div>
                        <div className="option__description">
                            {_("optionsAutoConnectDescription")}
                        </div>

                        <label className="option option--inline">
                            <div className="option__control">
                                <input
                                    name="rememberConnectedServer"
                                    type="checkbox"
                                    checked={
                                        optionsValues?.rememberConnectedServer
                                    }
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="option__label">
                                {_("optionsRememberConnectedServerLabel")}
                            </div>
                            <div className="option__description">
                                {_("optionsRememberConnectedServerDescription")}
                            </div>
                        </label>
                    </label>

                    <hr />

                    <label className="option option--inline proxy-dns-option">
                        <div className="option__control">
                            <input
                                name="proxyDns"
                                type="checkbox"
                                checked={optionsValues?.proxyDns}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="option__label">
                            {_("optionsProxyDnsLabel")}
                        </div>
                        <div className="option__description">
                            {_("optionsProxyDnsDescription")}
                        </div>
                    </label>

                    <hr />

                    <label className="option option--inline">
                        <div className="option__control">
                            <input
                                name="enableNotifications"
                                type="checkbox"
                                checked={optionsValues?.enableNotifications}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="option__label">
                            {_("optionsEnableNotificationsLabel")}
                        </div>
                        <div className="option__description">
                            {_("optionsEnableNotificationsDescription")}
                        </div>

                        <label className="option option--inline">
                            <div className="option__control">
                                <input
                                    name="enableNotificationsOnlyErrors"
                                    type="checkbox"
                                    checked={
                                        optionsValues?.enableNotificationsOnlyErrors
                                    }
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="option__label">
                                {_("optionsEnableNotificationsOnlyErrorsLabel")}
                            </div>
                        </label>
                    </label>

                    <hr />

                    <label className="option option--inline">
                        <div className="option__control">
                            <input
                                name="enableIpv6Lookups"
                                type="checkbox"
                                checked={optionsValues?.enableIpv6Lookups}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="option__label">
                            {_("optionsEnableIpv6LookupsLabel")}
                        </div>
                        <div className="option__description">
                            {_("optionsEnableIpv6LookupsDescription")}
                        </div>
                    </label>

                    <hr />

                    <label className="option option--inline">
                        <div className="option__control">
                            <input
                                name="enableDebugInfo"
                                type="checkbox"
                                checked={optionsValues?.enableDebugInfo}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="option__label">
                            {_("optionsEnableDebugInfoLabel")}
                        </div>
                        <div className="option__description">
                            {_("optionsEnableDebugInfoDescription")}
                        </div>
                    </label>

                    {browserType === utils.BrowserType.Firefox && (
                        <>
                            <hr />

                            <label className="option option--inline">
                                <div className="option__control">
                                    <input
                                        name="enableExcludeList"
                                        type="checkbox"
                                        checked={
                                            optionsValues?.enableExcludeList
                                        }
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="option__label">
                                    {_("optionsEnableExcludeListLabel")}
                                </div>

                                <label className="option">
                                    <div className="option__label">
                                        {_("optionsExcludeListLabel")}
                                    </div>
                                    <div className="option__description">
                                        {_("optionsExcludeListDescription")}
                                    </div>
                                    <div className="option__control">
                                        <textarea
                                            name="excludeList"
                                            onChange={handleExcludeListChange}
                                            value={optionsValues.excludeList.join(
                                                "\n"
                                            )}
                                            rows={8}
                                        ></textarea>
                                    </div>
                                </label>
                            </label>
                        </>
                    )}
                </>
            )}

            <hr />

            <div className="buttons">
                <button onClick={handleClearCache}>
                    {_("optionsClearCacheLabel")}
                </button>
                <button onClick={handleClearRecentServers}>
                    {_("optionsClearRecentServersLabel")}
                </button>
            </div>
        </form>
    );
};
