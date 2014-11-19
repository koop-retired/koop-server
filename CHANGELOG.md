2014-11-12
==========

  * new version
  * spaces in ogr2ogr call are no good
  * updating version
  * making sure no json parts get put into zip files

2014-11-11
==========

  * fixing status removal on delayed exports

2014-11-09
==========

  * version 0.1.24
  * feature service true as string check
  * Merge branch 'jgravois-patch-gp'
  * fixed console conflict
  * dynamic rest info
  * add POST

2014-11-07
==========

  * updating version
  * making sure tests all pass

2014-11-05
==========

  * adding new change log
  * upped version
  * forcing options.name to be used over the hash key for saved export file names

2014-11-04
==========

  * new version 0.1.22
  * adding support rest info and services
  * Merge pull request [#33](https://github.com/Esri/koop-server/issues/33) from jgravois/return-count-fix
    fix for 'returnCountOnly'
  * check for true as string
  * version 0.1.21
  * null values cast as strings in featureservice fields
  * making csv geojson replace commas from big numbers

2014-10-29
==========

  * new version
  * making the sql lite lib actually work

2014-10-28
==========

  * up version
  * skipfailures in ogr2ogr

2014-10-27
==========

  * reverting use of multigeoms

2014-10-26
==========

  * upping version
  * fixing csv geoms as points

2014-10-22
==========

  * new version fixing point shapefiles

2014-10-21
==========

  * status output fix
  * better status sha
  * version upgrade
  * fixing geometry check with no data

2014-10-20
==========

  * version 0.1.11
  * fix multi point partial inserts
  * better pg errors
  * change /services to /providers
  * adding a services endpoint to list registered services
  * check for json before deleting info object

2014-10-19
==========

  * up version
  * adding lat long _deg to csv whitelist

2014-10-15
==========

  * up version
  * adding point geom check in for zip
  * new version
  * cleaning up the paths for s3 files
  * new v
  * making zip files with spaces in the name work
  * version 0.1.5
  * adding better s3 removal

2014-10-14
==========

  * up version for lower mapnik support
  * rolling back mapnik version
  * up the version for error response on service get
  * return an error on new db with no server type tables
  * fixes tests
  * new version
  * adding status output to server
  * fixing file tests and logs
  * logging for exists on s3
  * logging for removes from s3
  * pass koop to files for logging
  * tiles work
  * tests passing, version 0.1.1
  * removeDir now drops s3 data and subdirs
  * remove git-rev
  * adding verion output
  * thumbs, tiles, and small exports working
  * full test coverage on files
  * adding fs wrapper test
  * adding a central file system wrapper
  * test passing
  * remove console
  * version 0.1.0
  * big rebase all fixed and good
  * fixing base controller pattern
  * tests passing with latest master merge
  * adding debug to all routes
  * adding basemodel
  * adding log to the base model
  * setting logging levels
  * exporter logging to koop logger
  * adding logger
  * deglobal is essentially ready
  * new loading pattern, cleaner
  * tests passing
  * using exec instead of spawn async
  * fixing featureservice queries
  * rm global config
  * remove log
  * tests all passing
  * removing config
  * working on the right inherit pattern
  * no more global scope
  * working on non-global pattern
