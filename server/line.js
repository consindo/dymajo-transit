var request = require('request')
var azure = require('azure-storage')
var wkx = require('wkx')

var tableSvc = azure.createTableService()



var shapeWKBOptions = {
    url: 'https://api.at.govt.nz/v2/gtfs/shapes/geometry/',
    headers: {
        'Ocp-Apim-Subscription-Key': process.env.atApiKey
    }
}

var allLines = {
    // TRAINS
    'STH': [['Britomart Train Station', 'Papakura Train Station']],
    'WEST': [['Britomart Train Station', 'Swanson Train Station']],

    // CITY
    'CTY': [['City Link', 'Wynyard Quarter', 'Greys Ave']],
    'INN': [['Inner Link Clockwise'],['Inner Link Anticlockwise']],

    // ISTHMUS
    'OUT': [['Outer Link Clockwise'],['Outer Link Anticlockwise']],
    '007': [['Pt Chevalier', 'St Heliers', 'Hospital And Selwyn Village'], ['Pt Chevalier', 'St Heliers', 'Selwyn Village And Hospital']],
    '233': [['Midtown', 'New Lynn', 'Sandringham Road and St Lukes']],
    '255': [['Civic Centre', 'May Rd'], ['Civic Centre', 'May Rd', 'Flyover']],
    '258': [['Civic Centre', 'Blockhouse Bay'], ['Civic Centre', 'Blockhouse Bay', 'Flyover']],
    '267': [['Civic Centre', 'Lynfield'], ['Civic Centre', 'Lynfield', 'Flyover']],
    '274': [['Britomart', 'Three Kings']],
    '277': [['Britomart', 'Waikowhai']],

    // SOUTH
    '500': [['Britomart', 'Mission Heights', 'Botany Town Centre']]
}

var line = {
    getLines: function(req, res) {
        res.send(allLines)
    },

    getLine: function(req, res) {
        var query = new azure.TableQuery()
            .where('route_short_name eq ?', req.params.line)
        tableSvc.queryEntities('routeShapes', query, null, function(err, result, response){
            if (err) {
                return reject(err)
            }
            var versions = {}
            var results = []
            result.entries.forEach(function(route){
                if (line.exceptionCheck(route) === true ){
                    var v = parseFloat(route.RowKey._.split('_v').slice(-1)[0])
                    if (typeof(versions[route.route_long_name._]) === 'undefined') {
                        versions[route.route_long_name._] = v 
                    } else if (v < versions[route.route_long_name._]) {
                        versions[route.route_long_name._] = v
                    }
                }
            })
            result.entries.forEach(function(route){
                if (typeof(versions[route.route_long_name._]) === 'undefined') {
                    return
                }
                if (versions[route.route_long_name._] === parseFloat(route.RowKey._.split('_v').slice(-1)[0])) {
                    versions[route.route_long_name._] = null // zero it so we can't have stuff with the same version_id
                    results.push({
                        route_id: route.RowKey._,
                        route_long_name: route.route_long_name._,
                        route_short_name: route.route_short_name._,
                        shape_id: route.shape_id._,
                        route_type: route.route_type._    
                    })
                }
            })
            res.send(results)
        })
    },
    getShape: function(req, res) {
        var newOpts = JSON.parse(JSON.stringify(shapeWKBOptions))
        newOpts.url += req.params.line
        request(newOpts, function(err, response, body){
            if (err) {
                res.send({
                    error: err
                })
                return
            }
            res.send(JSON.parse(body).response[0].the_geom)
        })  
    },

    exceptionCheck: function(route){
        // blanket thing for no schools
        if (route.trip_headsign._ === "Schools"){
            return false
        }
        if (typeof(allLines[route.route_short_name._]) === 'undefined') {
            return true
        }
        var retval = false
        allLines[route.route_short_name._].forEach(function(variant) {
            if (variant.length === 1 && route.route_long_name._ === variant[0]) {
                retval = true
            // normal routes - from x to x
            } else if (variant.length === 2) {
                var splitName = route.route_long_name._.toLowerCase().split(' to ')
                if (variant[0].toLowerCase() == splitName[0] && variant[1].toLowerCase() == splitName[1]) {
                    retval = true
                // reverses the order
                } else if (variant[1].toLowerCase() == splitName[0] && variant[0].toLowerCase() == splitName[1]) {
                    retval = true
                }
            // handles via Flyover or whatever
            } else if (variant.length === 3) {
                var splitName = route.route_long_name._.toLowerCase().split(' to ')
                if (splitName[1].split(' via ')[1] === variant[2].toLowerCase()) {
                    splitName[1] = splitName[1].split(' via ')[0]
                    if (variant[0].toLowerCase() === splitName[0] && variant[1].toLowerCase() === splitName[1]) {
                        retval = true
                    // reverses the order
                    } else if (variant[1].toLowerCase() === splitName[0] && variant[0].toLowerCase() === splitName[1]) {
                        retval = true
                    }
                }
            }
        })
        return retval

    }
}



module.exports = line

