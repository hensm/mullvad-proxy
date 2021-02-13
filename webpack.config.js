"use strict";

const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");


const INCLUDE_PATH = path.resolve(__dirname, "src");
const OUTPUT_PATH = path.resolve(__dirname, "dist");

module.exports = {
    entry: {
        "background": `${INCLUDE_PATH}/background.ts`
      , "ui/popup/popup": `${INCLUDE_PATH}/ui/popup/index.tsx`
      , "ui/options/options": `${INCLUDE_PATH}/ui/options/index.tsx`
    }
  , output: {
        filename: "[name].bundle.js"
      , path: OUTPUT_PATH
    }
  , module: {
        rules: [
            {
                test: /\.tsx?$/
              , resolve: {
                    extensions: [ ".ts", ".tsx" ]
                }
              , include: INCLUDE_PATH
              , use: "ts-loader"
            }
        ]
    }
  , plugins: [
        // Copy static assets
        new CopyWebpackPlugin([
            {
                from: INCLUDE_PATH
              , to: OUTPUT_PATH
              , ignore: [ "*.ts", "*.tsx" ]
            }
          , {
                from: "./node_modules/webextension-polyfill/dist/browser-polyfill.min.js"
            }
        ])
    ]
  , resolve: {
        alias: {
            "react": "preact/compat"
          , "react-dom": "preact/compat"
        }
    }
  , mode: "development"
  , devtool: "source-map"
};
