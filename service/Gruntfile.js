'use strict';

const saveLicense = require('uglify-save-license');

module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      mainCSS: {
        src: [
          'node_modules/font-awesome/css/font-awesome.css',
          'node_modules/bootstrap/dist/css/bootstrap.css',
          'node_modules/bootstrap/dist/css/bootstrap-theme.css',
          'frontend/freeyourstuff.css'
        ],
        dest: 'static/css/main.css'
      },
      mainJS: {
        src: [
          'node_modules/jquery/dist/jquery.js',
          'node_modules/bootstrap/dist/js/bootstrap.js',
          'node_modules/bootstrap-show-password/bootstrap-show-password.js',
          'node_modules/jquery.cookie/jquery.cookie.js',
          'frontend/signin.js'
        ],
        dest: 'static/js/main.js'
      },
      dataTablesJS: {
        src: [
          'node_modules/datatables.net/js/jquery.dataTables.js',
          'node_modules/datatables.net-bs/js/dataTables.bootstrap.js',
          'node_modules/datatables-buttons/js/dataTables.buttons.js',
          'node_modules/datatables-buttons/js/buttons.print.js',
          'node_modules/datatables-buttons/js/buttons.html5.js',
          'node_modules/datatables.net-buttons-bs/js/buttons.bootstrap.js'
        ],
        dest: 'static/js/datatables.js'
      },
      dataTablesCSS: {
        src: ['node_modules/datatables.net-bs/css/dataTables.bootstrap.css',
          'node_modules/datatables.net-buttons-bs/css/buttons.bootstrap.css'
        ],
        dest: 'static/css/datatables.css'
      }
    },
    babel: {
      options: {
        sourceMap: true,
        presets: ['babel-preset-es2015']
      },
      mainJS: {
        files: {
          'static/js/view-sitesets.js': 'frontend/view-sitesets.js',
          'static/js/view-uploads.js': 'frontend/view-uploads.js',
          'static/js/install.js': 'frontend/install.js'
        }
      }
    },
    copy: {
      fontawesome: {
        'cwd': 'node_modules/font-awesome/fonts/',
        'src': ['*'],
        expand: true,
        'dest': 'static/fonts/',
      },
      glyphicons: {
        'cwd': 'node_modules/bootstrap/fonts/',
        'src': ['*'],
        expand: true,
        'dest': 'static/fonts/',
      },
    },
    uglify: {
      options: {
        preserveComments: saveLicense
      },
      mainJS: {
        files: {
          'static/js/main.min.js': ['static/js/main.js']
        }
      },
      dataTablesJS: {
        files: {
          'static/js/datatables.min.js': ['static/js/datatables.js']
        }
      }
    },
    cssmin: {
      mainCSS: {
        files: {
          'static/css/main.min.css': ['static/css/main.css']
        }
      },
      dataTablesCSS: {
        files: {
          'static/css/datatables.min.css': ['static/css/datatables.css']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-babel');

  grunt.registerTask('default', ['babel', 'concat', 'uglify', 'cssmin', 'copy']);

};