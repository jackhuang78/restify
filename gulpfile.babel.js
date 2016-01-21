import gulp from 'gulp';
import mocha from 'gulp-mocha';
import babel from 'gulp-babel';
import eslint from 'gulp-eslint';
import jsdoc from 'gulp-jsdoc';
import del from 'del';
import polyfill from 'babel-polyfill';
import {argv} from 'yargs';


gulp.task('default', ['test'], () => {
	
});

gulp.task('clean', () => {
	return del(['build', 'doc']);
});

gulp.task('lint', () => {
	return gulp.src(['src/**/*.js', 'test/**/*.js'])
		.pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
});

gulp.task('test', ['lint'], () => {
	let file = (argv.f != null) ? argv.f : '**/*';
	return gulp.src(`test/${file}.js`)
		.pipe(babel())
		.pipe(mocha({grep: argv.grep}));
});

gulp.task('build', ['clean'], () => {
	return gulp.src('src/Restify.js')
    .pipe(babel())
    .pipe(gulp.dest('build'));
});

gulp.task('doc', ['build'], () => {
	return gulp.src('build/**/*.js')
		.pipe(jsdoc('doc'));
});

