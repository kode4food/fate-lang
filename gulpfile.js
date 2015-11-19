"use strict";

var fs = require('fs');
var path = require('path');

var gulp = require('gulp');
var typescript = require('gulp-typescript');
var nodeunit = require('gulp-nodeunit');
var istanbul = require('gulp-istanbul');
var enforcer = require('gulp-istanbul-enforcer');
var pegjs = require('gulp-peg');
var rename = require('gulp-rename');

var tsFiles = ['index.ts', 'lib/**/*.ts'];
var testFiles = ['./test/index.js'];
var coverageFiles = ['./test/*.js', './build/fate.js', './lib/**/*.js'];
var parserFile = ['./lib/compiler/parser.pegjs'];
var parserOutput = 'parser.js';

var tsProject = typescript.createProject('tsconfig.json');

var nodeUnitConfig = {
  reporter: 'default',
  reporterOptions: {
    output: 'test'
  }
};

var enforcerConfig = {
  thresholds: {
    statements: 99,
    branches: 89,
    functions: 99,
    lines: 99
  },
  coverageDirectory: 'coverage',
  rootDirectory: ''
};

function buildDir(filename) {
  if ( filename ) {
    return './' + path.join('./build', filename);
  }
  return './build';
}

function createUnitTests() {
  return gulp.src(testFiles).pipe(nodeunit(nodeUnitConfig));
}

gulp.task('parser', function (done) {
  gulp.src(parserFile)
      .pipe(pegjs())
      .pipe(rename(parserOutput))
      .pipe(gulp.dest(buildDir()))
      .on('end', done);
});

gulp.task('compile', ['parser'], function() {
  var tsResult = tsProject.src().pipe(typescript(tsProject));
  return tsResult.js.pipe(gulp.dest('.'));
});

gulp.task('test', ['compile'], function (done) {
  createUnitTests().on('end', done);
});

gulp.task('coverage', ['compile'], function (done) {
  gulp.src(coverageFiles)
      .pipe(istanbul())
      .pipe(istanbul.hookRequire())
      .on('finish', function () {
        createUnitTests().pipe(istanbul.writeReports()).on('end', done);
      });
});

gulp.task('enforce', ['coverage'], function (done) {
  gulp.src('.')
      .pipe(enforcer(enforcerConfig))
      .on('end', done);
});

gulp.task('watch', ['compile'], function () {
  gulp.watch(tsFiles, ['compile']);
});

gulp.task('build', ['enforce']);
gulp.task('default', ['build']);
