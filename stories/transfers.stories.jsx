import React from 'react'

import { storiesOf } from '@storybook/react'
import Transfers from '../js/views/lines/stops/LineStopsTransfers'

storiesOf('Transfers', module)
  .add('no transfers', () => (
    <Transfers currentLine={1} transfers={[[1, '#fff']]} />
  ))
  .add('1 transfer', () => (
    <Transfers currentLine={1} transfers={[[1, '#fff'], [2, '#000']]} />
  ))
  .add('many transfers', () => (
    <Transfers
      currentLine={1}
      transfers={[[1, '#fff'], [2, '#000'], [3, '#777']]}
    />
  ))
