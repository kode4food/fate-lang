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

var supportFiles = ['src/**/*.js', 'src/**/*.fate'];
var tsFiles = ['src/**/*.ts'];
var testFiles = ['./test/index.js'];
var coverageFiles = ['./test/**/*.js', './dist/**/*.js',
                     '!./dist/compiler/parser.js'];
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
    statements: 99.87,
    branches: 96.78,
    functions: 100,
    lines: 100
  },
  coverageDirectory: 'coverage',
  rootDirectory: ''
};

function buildDir(filename) {
  if ( filename ) {
    return path.join('./dist', filename);
  }
  return './dist';
}

function createUnitTests() {
  return gulp.src(testFiles)
             .pipe(nodeunit(nodeUnitConfig));
}

gulp.task('clean', function () {
  return del([buildDir('**/*')]);
});

gulp.task('prepare', ['clean'], function () {
  return gulp.src(supportFiles)
             .pipe(copy(buildDir(), { prefix: 1 }));
});

gulp.task('parser', ['prepare'], function () {
  return gulp.src(parserFile)
             .pipe(pegjs())
             .pipe(rename(parserOutput))
             .pipe(gulp.dest(buildDir('compiler')));
});

gulp.task('compile', ['parser'], function() {
  return gulp.src(tsFiles)
             .pipe(typescript(tsProject))
             .js
             .pipe(gulp.dest(buildDir()));
});

gulp.task('test', ['compile'], function () {
  return createUnitTests();
});

gulp.task('lint', function() {
  return gulp.src(tsFiles)
             .pipe(tslint())
             .pipe(tslint.report('verbose', {
               summarizeFailureOutput: true
             }));
});

gulp.task('coverage', ['compile'], function (done) {
  gulp.src(coverageFiles)
      .pipe(istanbul())
      .pipe(istanbul.hookRequire())
      .on('finish', function () {
        createUnitTests().pipe(istanbul.writeReports()).on('end', done);
      });
});

gulp.task('enforce', ['lint', 'coverage'], function () {
  return gulp.src('.').pipe(enforcer(enforcerConfig));
});

gulp.task('watch', ['compile'], function () {
  gulp.watch(tsFiles, ['compile']);
});

gulp.task('build', ['enforce']);
gulp.task('default', ['build']);
