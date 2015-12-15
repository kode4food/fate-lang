"use strict";

import { runScript } from '../Fate';
import { createModule } from '../Types';

export function commandLine(inputArgs: string[], console: Console,
                            completedCallback: Function) {
  let arg0 = inputArgs[0];

  if ( !arg0 ) {
    console.error("Usage: fate <script name>");
    completedCallback(-1);
    return;
  }

  let match = /^(.+?)?(\.fate)?$/.exec(arg0);
  let filename = match[1] + '.fate';
  runScript(filename, createModule());
  completedCallback(0);
}
