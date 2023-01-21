"use strict";

import React, { useEffect, useMemo, useRef } from "react";
import * as focusTrap from "focus-trap";

import { OptionsView } from "../options/OptionsView";

const _ = browser.i18n.getMessage;

interface OptionsPanelProps {
    open: boolean;
    onClose: () => void;
}
const optionsPanelClass = "panel";

export const OptionsPanel = (props: OptionsPanelProps) => {
    const panelElement = useRef<HTMLDivElement>(null);

    const trap = useMemo(() => {
        if (!panelElement.current) return;
        return focusTrap.createFocusTrap(panelElement.current, {
            escapeDeactivates: false,
            fallbackFocus: `.${optionsPanelClass}`
        });
    }, []);

    const panelClassNames = useMemo(() => {
        let classNames = optionsPanelClass;
        if (props.open) {
            classNames += ` ${classNames}--visible`;
        }
        return classNames;
    }, [props.open]);

    useEffect(() => {
        if (props.open) {
            trap?.activate();
        } else {
            trap?.deactivate();
        }
    }, [props.open, trap]);

    return (
        <div className={panelClassNames} ref={panelElement} tabIndex={-1}>
            <div className="panel__header">
                <h2 className="panel__title">{_("optionsPanelTitle")}</h2>
                <button
                    className="panel__tab-button"
                    onClick={() => browser.runtime.openOptionsPage()}
                >
                    {_("optionsPanelViewInTab")}
                </button>
                <button
                    className="panel__close-button"
                    onClick={() => props.onClose()}
                >
                    {_("optionsPanelClose")}
                </button>
            </div>
            <div className="panel__content">
                <OptionsView />
            </div>
        </div>
    );
};
