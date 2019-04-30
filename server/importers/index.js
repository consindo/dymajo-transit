const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const sql = require('mssql')

const log = require('../logger.js')
const GtfsImport = require('../db/gtfs-import.js')
const CreateShapes = require('../db/create-shapes.js')
const connection = require('../db/connection.js')
const Storage = require('../db/storage.js')
const KeyvalueDynamo = require('../db/keyvalue-dynamo.js')
const config = require('../config')

const ATImporter = require('./regions/nz-akl')
const ChchImporter = require('./regions/nz-chc')
const OtagoImporter = require('./regions/nz-otg')
const TCImporter = require('./regions/au-cbr')
const TfNSWImporter = require('./regions/au-syd')
const MetlinkImporter = require('./regions/nz-wlg')

const regions = {
  'nz-akl': ATImporter,
  'nz-chc': ChchImporter,
  'nz-otg': OtagoImporter,
  'nz-wlg': MetlinkImporter,
  'au-seq': SEQImporter,
  'au-mel': PTVImporter,
  'fr-par': RATPImporter,
  'ch-sfr': SBBCFFFFSImporter,
}

class Importer {
  constructor(props) {
    this.importer = new GtfsImport()
    this.storage = new Storage({})

    const { keyvalue, keyvalueVersionTable, keyvalueRegion } = props
    this.versions = null
    if (keyvalue === 'dynamo') {
      this.versions = new KeyvalueDynamo({
        name: keyvalueVersionTable,
        region: keyvalueRegion,
      })
    }

    this.current = null
    try {
      const Region = regions[config.prefix]
      this.current = new Region()
    } catch (err) {
      log(
        'fatal error'.red,
        'Could not find an importer in ',
        path.join(__dirname, './regions', `${config.prefix}.js`)
      )
    }
  }

  async start(created = false) {
    if (!this.current) {
      return
    }

    const { versions } = this
    const versionId = config.db.database
    if (versions) {
      const version = await versions.get(versionId)
      let newStatus
      if (version.status === 'pendingimport') {
        newStatus = 'importing'
      } else if (version.status === 'pendingimport-willmap') {
        newStatus = 'importing-willmap'
      } else {
        log(versionId, 'Status is not pending! Cancelling import!')
        return
      }
      version.status = newStatus
      await versions.set(versionId, version)
      log(versionId, 'Updated status to', newStatus)
    }

    // if the db is already there, avoid the first few steps
    if (!created) {
      await this.download()
      await this.unzip()
      await this.db()
    } else {
      console.warn('DB already created - skipping download & unzip.')
    }
    // await this.shapes()
    await this.fixStopCodes()
    await this.fixRoutes()
    await this.postImport()
    // await this.exportDb()

    if (versions) {
      const version = await versions.get(versionId)
      let newStatus
      if (version.status === 'importing') {
        newStatus = 'imported'
      } else if (version.status === 'importing-willmap') {
        newStatus = 'imported-willmap'
      } else {
        return
      }
      version.status = newStatus
      await versions.set(versionId, version)
      log(versionId, 'Updated status to', newStatus)
    }
  }

  async unzip() {
    await this.importer.unzip(this.current.zipLocation)
  }

  async download() {
    await this.current.download()
  }

  async db() {
    for (const file of this.current.files) {
      await this.importer.upload(
        `${this.current.zipLocation}unarchived`,
        file,
        config.version,
        file.versioned
      )
    }
  }

  async shapes() {
    if (!fs.existsSync(this.current.zipLocation)) {
      console.warn('Shapes could not be found!')
      return
    }

    const creator = new CreateShapes()
    const inputDir = path.resolve(
      `${this.current.zipLocation}unarchived`,
      'shapes.txt'
    )
    const outputDir = path.resolve(
      `${this.current.zipLocation}unarchived`,
      'shapes'
    )
    const outputDir2 = path.resolve(outputDir, config.version)

    // make sure the old output dir exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir)
    }

    // cleans up old import if exists
    if (fs.existsSync(outputDir2)) {
      await new Promise((resolve, reject) => {
        rimraf(outputDir2, resolve)
      })
    }
    fs.mkdirSync(outputDir2)

    // creates the new datas
    await creator.create(inputDir, outputDir, [config.version])

    const containerName = `${config.prefix}-${config.version}`
      .replace('.', '-')
      .replace('_', '-')
    await creator.upload(
      config.shapesContainer,
      path.resolve(outputDir, config.version)
    )
  }

  async fixStopCodes() {
    // GTFS says it's optional, but Waka uses stop_code for stop lookups
    const sqlRequest = connection.get().request()
    const res = await sqlRequest.query(`
      UPDATE stops
      SET stop_code = stop_id
      WHERE stop_code is null;
    `)
    const rows = res.rowsAffected[0]
    log(
      `${config.prefix} ${config.version}`.magenta,
      `Updated ${rows} null stop codes`
    )
  }

  async fixRoutes() {
    const sqlRequest = connection.get().request()
    const res = await sqlRequest.query(`
      UPDATE routes
      SET route_long_name = route_short_name
      WHERE route_long_name is null;
    `)
    const rows = res.rowsAffected[0]
    log(
      `${config.prefix} ${config.version}`.magenta,
      `Updated ${rows} null route codes`
    )
  }

  async postImport() {
    if (this.current.postImport) {
      await this.current.postImport()
    }
  }

  async exportDb() {
    const sqlRequest = connection.get().request()
    const {
      db: { database },
    } = config
    sqlRequest.input('dbName', sql.VarChar, database)
    try {
      await sqlRequest.query(
        `
        USE master;
        ALTER DATABASE ${database} SET RECOVERY SIMPLE;
        BACKUP DATABASE ${database} TO  DISK =
        N'/var/opt/mssql/backup/backup.bak'
        WITH NOFORMAT, NOINIT, NAME = ${database},
        SKIP, NOREWIND, NOUNLOAD, STATS = 10
        `
      )
    } catch (err) {
      console.log(err)
    }
  }
}
module.exports = Importer
