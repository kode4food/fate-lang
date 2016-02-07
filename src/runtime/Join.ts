"use strict";

import { GlobalScheduler } from '../Scheduler';

let slice = Array.prototype.slice;

export interface Channel {
  (...args: any[]): void;
  __fateChannel?: boolean;
}

export function defineChannel(value: Channel) {
  value.__fateChannel = true;
  return value;
}

function channelNotExhaustive(joinArgs: JoinArguments) {
  if ( !joinArgs.provided ) {
    throw new Error("Channel invocation not exhaustive");
  }
}

let notExhaustive = defineChannel(channelNotExhaustive);

export function ensureChannel(value: Channel) {
  return isFateChannel(value) ? value : notExhaustive;
}

export function isFateChannel(channel: any) {
  return typeof channel === 'function' && channel.__fateChannel;
}

class JoinArguments {
  public provided: boolean;
  public consumed: boolean;
  public argumentArray: any[];

  constructor(callArguments: IArguments) {
    this.argumentArray = [this].concat(slice.call(callArguments));
  }
}

export function joinArguments(joinArgs?: JoinArguments) {
  if ( joinArgs instanceof JoinArguments ) {
    return joinArgs.argumentArray;
  }
  return new JoinArguments(arguments).argumentArray;
}

export function join(body: Function, ...argCount: number[]) {
  let argumentSets: JoinArguments[][] = [];
  return provideArguments;

  function provideArguments(signatureIndex: number, args: JoinArguments) {
    args.provided = true;

    // This is not the most efficient implementation... don't care
    let argumentSet = argumentSets[signatureIndex];
    if ( argumentSet ) {
      argumentSet.push(args);
    }
    else {
      argumentSets[signatureIndex] = [args];
    }
    attemptToSatisfy();
  }

  function attemptToSatisfy() {
    let argumentIndexes: number[] = [];
    for ( let i = 0; i < argCount.length; i++ ) {
      let argumentSet = argumentSets[i];
      if ( !argumentSet ) {
        return;
      }

      for ( let j = 0; j < argumentSet.length; j++ ) {
        let args = argumentSet[j];
        if ( !args || args.consumed ) {
          continue;
        }
        argumentIndexes[i] = j;
        break;
      }

      if ( argumentIndexes[i] === undefined ) {
        return;
      }
    }
    satisfyWith(argumentIndexes);
  }

  function satisfyWith(argumentIndexes: number[]) {
    let args: any[] = [];
    let argsLength = 0;

    argumentIndexes.forEach(function (argumentIndex, setIndex) {
      let argumentSet = argumentSets[setIndex];
      let inputArgs = argumentSet[argumentIndex];

      // build the arguments to be passed
      inputArgs.consumed = true;
      args = args.concat(inputArgs.argumentArray.slice(1));
      argsLength += argCount[setIndex];
      args.length = argsLength;

      // cleanup
      argumentSet[argumentIndex] = null;
      argumentSets[setIndex] = argumentSet.filter(value => value !== null);
    });

    GlobalScheduler.queue(body, args);
  }
}
