const path = require('path')
module.exports = {
  zipLocation: path.join(__dirname, '../../cache/at.zip'),
  files: [
    {
      name: 'agency.txt',
      table: 'agency',
      versioned: false,
    },
    {
      name: 'stops.txt',
      table: 'stops',
      versioned: true,
    },
    {
      name: 'routes.txt',
      table: 'routes',
      versioned: true,
    },
    {
      name: 'trips.txt',
      table: 'trips',
      versioned: true,
    },
    {
      name: 'stop_times.txt',
      table: 'stop_times',
      versioned: true,
    },
    {
      name: 'calendar.txt',
      table: 'calendar',
      versioned: true,
    },
    {
      name: 'calendar_dates.txt',
      table: 'calendar_dates',
      versioned: true,
    },
  ],
  shapeFile: 'shapes.txt'
}