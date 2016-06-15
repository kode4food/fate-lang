/// <reference path="../../typings/tsd.d.ts" />

"use strict";

import minimist = require("minimist");

import { VERSION, runScript } from '../Fate';
import { createModule } from '../Types';

interface ParsedArguments {
  'help'?: boolean;
  '_'?: string[];
}

export function commandLine(inputArgs: string[], console: Console,
                            completedCallback: Function) {
  let badArg = false;

  let args = <ParsedArguments>minimist(inputArgs, {
    boolean: ['help'],
    unknown: value => {
      let invalidFlag = /^--.+/.test(value);
      badArg = badArg || invalidFlag;
      return !invalidFlag;
    }
  });

  if ( !inputArgs.length || badArg || args.help ) {
    displayUsage();
    completedCallback(badArg ? -1 : 0);
    return;
  }

  let match = /^(.+?)?(\.fate)?$/.exec(args._[0]);
  let filename = match[1] + '.fate';
  runScript(filename, createModule());
  completedCallback(0);

  function displayVersion() {
    console.info("Fate v" + VERSION);
  }

  function displayUsage() {
    displayVersion();
    console.info(
`
  Usage:

    fate (options) <script name>

  Where:

    Options:

    --help         - You're looking at me right now
`
    );
  }
}
