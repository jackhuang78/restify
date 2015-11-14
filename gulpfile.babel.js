import gulp from 'gulp';
import mocha from 'gulp-mocha';
import babel from 'gulp-babel';
import eslint from 'gulp-eslint';

gulp.task('default', () => {
	console.log('Hello Gulp!');
});

gulp.task('lint', () => {
	return gulp.src(['src/**/*.js', 'test/**/*.js'])
		.pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
});

gulp.task('test', () => {
	return gulp.src('test/**/*.js')
		.pipe(mocha({compiler: {js: babel}}));
});