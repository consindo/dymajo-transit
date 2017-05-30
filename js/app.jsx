import React from 'react'
import ReactDOM from 'react-dom'
import { Router, IndexRoute, Route, Link, browserHistory } from 'react-router'
import { iOS } from './models/ios.js'
import { UiStore } from './stores/uiStore.js'

import Index from './views/index.jsx'
import Station from './views/station.jsx'
import Settings from './views/settings.jsx'
import NoMatch from './views/nomatch.jsx'
import Lines from './views/lines.jsx'
import TestLines from './views/test_lines.jsx'
import VehicleLocationBootstrap from './views/vehicle_loc_bootstrap.jsx'
import Timetable from './views/timetable.jsx'

import autotrack from 'autotrack' // google analytics
import injectTapEventPlugin from 'react-tap-event-plugin'
injectTapEventPlugin()

class App extends React.Component {

  render() {
    return (
      <Router history={browserHistory}>
        <Route path="/" component={Index} onChange={UiStore.handleReactChange}>
          <Route path="s/:station" component={Station}>
            <Route path="realtime/:trip_id" component={VehicleLocationBootstrap} />
            <Route path="timetable/:route_name" component={Timetable} />
          </Route>
          <Route path='l' component={Lines}>
            <Route path=":line_id" component={VehicleLocationBootstrap} />
          </Route>
          <Route path="testlines" component={TestLines} />

          <Route path="settings" component={Settings}/>
          <Route path="*" component={NoMatch}/>
        </Route>
      </Router>
    )
  }
}
document.addEventListener('DOMContentLoaded', function(event) {
  if (process.env.NODE_ENV === 'production') {
    document.getElementById('app').className = 'production'
  }
  startApp()
})
let startApp = function() {
  ReactDOM.render(<App />, document.getElementById('app'))
}
document.ontouchmove = iOS.touchMoveFix