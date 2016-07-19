"use strict";

const fs = require('fs');
const path = require('path');

const gulp = require('gulp');
const typescript = require('gulp-typescript');
const nodeunit = require('gulp-nodeunit');
const istanbul = require('gulp-istanbul');
const enforcer = require('gulp-istanbul-enforcer');
const pegjs = require('gulp-peg');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const copy = require('gulp-copy');
const tslint = require('gulp-tslint');
const del = require('del');

const supportFiles = ['src/**/*.js', 'src/**/*.fate'];
const tsFiles = ['src/**/*.ts'];
const testFiles = ['./test/index.js'];
const coverageFiles = ['./test/**/*.js', './dist/**/*.js',
                     '!./dist/compiler/parser.js'];
const parserFile = ['./src/compiler/parser.pegjs'];
const parserOutput = 'parser.js';

const extendSignature = 'var __extends =';
const exportSignature = 'function __export(m)';
const ignoreNext = '/* istanbul ignore next */\n';

const tsProject = typescript.createProject('./src/tsconfig.json');

const nodeUnitConfig = {
  reporter: 'default',
  reporterOptions: {
    output: 'test'
  }
};

const enforcerConfig = {
  thresholds: {
    statements: 100,
    branches: 100,
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
  return del([
    buildDir('**/*')
  ]);
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
             .pipe(replace(extendSignature, ignoreNext + extendSignature))
             .pipe(replace(exportSignature, ignoreNext + exportSignature))
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
