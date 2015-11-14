import gulp from 'gulp';
import mocha from 'gulp-mocha';
import babel from 'gulp-babel';

gulp.task('default', () => {
	console.log('Hello Gulp!');
});

gulp.task('test', () => {
	return gulp.src('test/**/*.js')
		.pipe(mocha({compiler: {js: babel}}));
});