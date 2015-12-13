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
var copy = require('gulp-copy');
var tslint = require('gulp-tslint');
var del = require('del');

var jsFiles = ['src/**/*.js'];
var tsFiles = ['src/**/*.ts'];
var testFiles = ['./test/index.js'];
var coverageFiles = ['./test/**/*.js', './build/**/*.js',
                     '!./build/compiler/parser.js'];
var parserFile = ['./src/compiler/parser.pegjs'];
var parserOutput = 'parser.js';

var tsProject = typescript.createProject('./src/tsconfig.json');

var nodeUnitConfig = {
  reporter: 'default',
  reporterOptions: {
    output: 'test'
  }
};

var enforcerConfig = {
  thresholds: {
    statements: 99.83,
    branches: 97.11,
    functions: 100,
    lines: 99.94
  },
  coverageDirectory: 'coverage',
  rootDirectory: ''
};

function buildDir(filename) {
  if ( filename ) {
    return path.join('./build', filename);
  }
  return './build';
}

function createUnitTests() {
  return gulp.src(testFiles).pipe(nodeunit(nodeUnitConfig));
}

gulp.task('clean', function () {
  return del([buildDir('**/*')]);
});

gulp.task('prepare', ['clean'], function (done) {
  gulp.src(jsFiles)
      .pipe(copy(buildDir(), { prefix: 1 }))
      .on('end', done);
});

gulp.task('parser', function (done) {
  gulp.src(parserFile)
      .pipe(pegjs())
      .pipe(rename(parserOutput))
      .pipe(gulp.dest(buildDir('compiler')))
      .on('end', done);
});

gulp.task('lint', function() {
  return gulp.src(tsFiles)
             .pipe(tslint())
             .pipe(tslint.report('verbose', {
               summarizeFailureOutput: true
             }));
});

gulp.task('compile', ['prepare', 'parser'], function(done) {
  gulp.src(tsFiles)
      .pipe(typescript(tsProject))
      .js
      .pipe(gulp.dest('./build'))
      .on('end', done);

//  var tsResult = tsProject.src().pipe(typescript(tsProject));
//  return tsResult.js.pipe(gulp.dest('.'));
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
