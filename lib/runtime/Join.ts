namespace Fate.Runtime {
  var slice = Array.prototype.slice;

  class JoinArguments {
    public consumed: boolean;
    constructor(public args: any[]) { }
  }

  export function joinArguments(args: any[]) {
    var result = args[0];
    if ( !(result instanceof JoinArguments) ) {
      return new JoinArguments(slice.call(args));
    }

    var resultArgs = result.args;
    for ( var i = 0; i < resultArgs.length; i++ ) {
      args[i] = resultArgs[i];
    }
    return result;
  }

  export function join(body: Function, ...argCount: number[]) {
    var satisfied = false;
    var argumentSets: JoinArguments[][] = [];
    return provideArguments;

    function provideArguments(signatureIndex: number, args: JoinArguments) {
      if ( satisfied ) {
        return;
      }

      // This is not the most efficient implementation... don't care
      var argumentSet = argumentSets[signatureIndex];
      if ( argumentSet ) {
        argumentSet.push(args);
      }
      else {
        argumentSets[signatureIndex] = [args];
      }
      attemptToSatisfy();
    }

    function attemptToSatisfy() {
      var argumentIndexes:number[] = [];
      for ( var i = 0; i < argCount.length; i++ ) {
        var argumentSet = argumentSets[i];
        if ( !argumentSet ) {
          return;
        }

        for ( var j = 0; j < argumentSet.length; j++ ) {
          var args = argumentSet[j];
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
      var args: any[] = [];
      var argsLength = 0;

      argumentIndexes.forEach(function (argumentIndex, setIndex) {
        var argumentSet = argumentSets[setIndex];
        var inputArgs = argumentSet[argumentIndex];
        inputArgs.consumed = true;
        args = args.concat(inputArgs.args);
        argsLength += argCount[setIndex];
        args.length = argsLength;
      });

      satisfied = true;
      argumentSets = null;
      body.apply(null, args);
    }
  }
}
