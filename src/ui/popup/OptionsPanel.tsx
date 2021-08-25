"use strict";

import React from "react";
import * as focusTrap from "focus-trap";

import { Options } from "../../lib/options";
import { OptionsView } from "../options/OptionsView";

const _ = browser.i18n.getMessage;

interface OptionsPanelProps {
    open: boolean;
    onClose(): void;
}
interface OptionsPanelState {
    options?: Options;
}

const optionsPanelClass = "panel";

export class OptionsPanel extends React.Component<
    OptionsPanelProps,
    OptionsPanelState
> {
    private panelRef = React.createRef<HTMLDivElement>();
    private trap?: focusTrap.FocusTrap;

    componentDidMount() {
        const panelElement = this.panelRef.current;
        if (!panelElement) {
            return;
        }

        this.trap = focusTrap.createFocusTrap(panelElement, {
            escapeDeactivates: false,
            fallbackFocus: `.${optionsPanelClass}`
        });
    }

    render() {
        let panelClass = optionsPanelClass;
        if (this.props.open) {
            panelClass += ` ${panelClass}--visible`;
        }

        if (this.props.open) {
            this.trap?.activate();
        } else {
            this.trap?.deactivate();
        }

        return (
            <div className={panelClass} ref={this.panelRef} tabIndex={-1}>
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
                        onClick={() => this.props.onClose()}
                    >
                        {_("optionsPanelClose")}
                    </button>
                </div>
                <div className="panel__content">
                    <OptionsView />
                </div>
            </div>
        );
    }
}
