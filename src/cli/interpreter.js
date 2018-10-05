/** @flow */

import minimist from 'minimist';
import { VERSION, runScript, createModule } from '../fate';

export function commandLine(inputArgs: string[], console: Console,
                            completedCallback: Function) {
  let badArg = false;

  const args = minimist(inputArgs, {
    boolean: ['help'],
    unknown: (value) => {
      const invalidFlag = /^--.+/.test(value);
      badArg = badArg || invalidFlag;
      return !invalidFlag;
    },
  });

  if (!inputArgs.length || badArg || args.help) {
    displayUsage();
    completedCallback(badArg ? -1 : 0);
    return;
  }

  const match = (/^(.+?)?(\.fate)?$/.exec(args._[0]): any);
  const filename = `${match[1]}.fate`;
  runScript(filename, createModule());
  completedCallback(0);

  function displayVersion() {
    console.info(`Fate v${VERSION}`);
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
`,
    );
  }
}
