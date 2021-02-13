"use strict";

import React from "react";

import options, { Options } from "../../../lib/options";
import { OptionsView } from "../../options/OptionsView"


const _ = browser.i18n.getMessage;


function getInputValue (input: HTMLInputElement) {
    switch (input.type) {
        case "checkbox":
            return input.checked;
        /*case "number":
            return parseFloat(input.value);*/

        default:
            return input.value;
    }
}


interface OptionsPanelProps {
    open: boolean;
    onClose (): void;
}
interface OptionsPanelState {
    options?: Options;
}

export class OptionsPanel extends React.Component<
        OptionsPanelProps, OptionsPanelState> {

    render () {
        let panelClassName = "panel";
        if (this.props.open) {
            panelClassName += " panel--visible";
        }

        return (
            <div className={ panelClassName }>
                <div className="panel__header">
                    <h2 className="panel__title">
                        { _("optionsPanelTitle") }
                    </h2>
                    <button className="panel__tab-button"
                            onClick={ () => browser.runtime.openOptionsPage() }>
                        { _("optionsPanelViewInTab") }
                    </button>
                    <button className="panel__close-button"
                            onClick={ () => this.props.onClose() }>
                        { _("optionsPanelClose") }
                    </button>
                </div>
                <div className="panel__content">
                    <OptionsView />
                </div>
            </div>
        )
    }
}
