import React from "react";

interface LoadingIndicatorProps {
    text: string;
    duration?: number;
}
interface LoadingIndicatorState {
    ellipsis: string;
}

export default class LoadingIndicator extends React.Component<
    LoadingIndicatorProps,
    LoadingIndicatorState
> {
    constructor(props: LoadingIndicatorProps) {
        super(props);
        this.state = {
            ellipsis: ""
        };

        setInterval(() => {
            this.setState(prevState => ({
                ellipsis: this.getNextEllipsis(prevState.ellipsis)
            }));
        }, this.props.duration ?? 500);
    }

    render() {
        return (
            <div className="loading">
                {this.props.text}
                {this.state.ellipsis}
            </div>
        );
    }

    private getNextEllipsis(ellipsis: string) {
        /* tslint:disable:curly */
        if (ellipsis === "") return ".";
        if (ellipsis === ".") return "..";
        if (ellipsis === "..") return "...";
        if (ellipsis === "...") return "";
        /* tslint:enable:curly */

        return "";
    }
}
